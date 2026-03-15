import { wsClient } from "$lib/ws.svelte";
import { auth } from "$lib/stores/auth.svelte";
import { VAD_THRESHOLD_DEFAULT } from "@tulpo/shared";
import type { PublicUser } from "@tulpo/shared";

export interface CallParticipant {
  user_id: string;
  user: PublicUser;
  is_muted: boolean;
  is_deafened: boolean;
}

export interface IncomingCallInfo {
  call_id: string;
  channel_id: string;
  caller: PublicUser;
  participants: CallParticipant[];
}

const VOICE_SETTINGS_KEY = "tulpo_voice_settings";

function loadVoiceSettings() {
  try {
    const raw = localStorage.getItem(VOICE_SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveVoiceSettings(settings: any) {
  localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(settings));
}

function createVoiceStore() {
  // Call state
  let activeCall = $state<{
    id: string;
    channel_id: string;
    status: "ringing" | "active";
    participants: CallParticipant[];
  } | null>(null);

  let incomingCall = $state<IncomingCallInfo | null>(null);

  // Local media
  let localStream: MediaStream | null = null;
  let isMuted = $state(false);
  let isDeafened = $state(false);

  // Speaking
  let speakingUsers = $state<Set<string>>(new Set());
  let localSpeaking = false;
  let vadAnimationFrame: number | null = null;
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;

  // Per-user volume
  let userVolumes = $state<Record<string, number>>({});

  // Device settings
  const saved = loadVoiceSettings();
  let inputDeviceId = $state<string>(saved.inputDeviceId || "");
  let outputDeviceId = $state<string>(saved.outputDeviceId || "");
  let inputSensitivity = $state<number>(saved.inputSensitivity ?? VAD_THRESHOLD_DEFAULT);
  let availableDevices = $state<MediaDeviceInfo[]>([]);

  // WebRTC
  const peerConnections = new Map<string, RTCPeerConnection>();
  const remoteAudioElements = new Map<string, HTMLAudioElement>();
  const gainNodes = new Map<string, { ctx: AudioContext; gain: GainNode; source: MediaStreamAudioSourceNode; dest: MediaStreamAudioDestinationNode }>();

  // Rejoin state
  let canRejoin = $state(false);
  let rejoinCallId = $state<string | null>(null);
  let rejoinTimeout = $state<ReturnType<typeof setTimeout> | null>(null);

  // WS event unsubs
  let unsubs: (() => void)[] = [];

  function getIceConfig(): RTCConfiguration {
    return {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    };
  }

  async function getMediaStream(): Promise<MediaStream | null> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: inputDeviceId ? { deviceId: { exact: inputDeviceId } } : true,
      };
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.error("[voice] Failed to get mic:", err);
      return null;
    }
  }

  function setupVAD(stream: MediaStream) {
    try {
      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 512;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      function check() {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
        const nowSpeaking = avg > inputSensitivity;

        if (nowSpeaking !== localSpeaking) {
          localSpeaking = nowSpeaking;
          if (activeCall) {
            wsClient.sendEvent("VOICE_SPEAKING", {
              call_id: activeCall.id,
              speaking: nowSpeaking,
            });
            // Update local speaking state
            if (nowSpeaking) {
              speakingUsers = new Set([...speakingUsers, auth.user!.id]);
            } else {
              const next = new Set(speakingUsers);
              next.delete(auth.user!.id);
              speakingUsers = next;
            }
          }
        }
        vadAnimationFrame = requestAnimationFrame(check);
      }
      check();
    } catch (err) {
      console.error("[voice] VAD setup failed:", err);
    }
  }

  function stopVAD() {
    if (vadAnimationFrame) {
      cancelAnimationFrame(vadAnimationFrame);
      vadAnimationFrame = null;
    }
    if (audioContext) {
      audioContext.close();
      audioContext = null;
      analyser = null;
    }
    localSpeaking = false;
  }

  async function createPeerConnection(targetUserId: string, isOfferer: boolean) {
    if (!localStream || !activeCall) return;

    const pc = new RTCPeerConnection(getIceConfig());
    peerConnections.set(targetUserId, pc);

    // Add local tracks
    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }

    // Handle remote tracks
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (!remoteStream) return;

      // Create audio element for playback
      const audio = new Audio();
      audio.autoplay = true;

      // Apply per-user volume via GainNode
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(remoteStream);
      const gain = ctx.createGain();
      gain.gain.value = (userVolumes[targetUserId] ?? 100) / 100;
      source.connect(gain);
      const dest = ctx.createMediaStreamDestination();
      gain.connect(dest);
      audio.srcObject = dest.stream;

      // Set output device if supported
      if (outputDeviceId && 'setSinkId' in audio) {
        (audio as any).setSinkId(outputDeviceId).catch(() => {});
      }

      audio.play().catch(() => {});
      remoteAudioElements.set(targetUserId, audio);
      gainNodes.set(targetUserId, { ctx, gain, source, dest });
    };

    // ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && activeCall) {
        wsClient.sendEvent("RTC_ICE_CANDIDATE", {
          call_id: activeCall.id,
          target_user_id: targetUserId,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        console.warn(`[voice] Peer ${targetUserId} connection ${pc.connectionState}`);
      }
    };

    // Create offer if we're the offerer (lower user ID creates offer)
    if (isOfferer) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      wsClient.sendEvent("RTC_OFFER", {
        call_id: activeCall.id,
        target_user_id: targetUserId,
        sdp: pc.localDescription,
      });
    }
  }

  async function handleRtcOffer(data: any) {
    if (!localStream || !activeCall) return;
    const { from_user_id, sdp } = data;

    let pc = peerConnections.get(from_user_id);
    if (!pc) {
      await createPeerConnection(from_user_id, false);
      pc = peerConnections.get(from_user_id);
    }
    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    wsClient.sendEvent("RTC_ANSWER", {
      call_id: activeCall.id,
      target_user_id: from_user_id,
      sdp: pc.localDescription,
    });
  }

  async function handleRtcAnswer(data: any) {
    const { from_user_id, sdp } = data;
    const pc = peerConnections.get(from_user_id);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    }
  }

  async function handleIceCandidate(data: any) {
    const { from_user_id, candidate } = data;
    const pc = peerConnections.get(from_user_id);
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  function cleanupPeerConnections() {
    for (const [uid, pc] of peerConnections) {
      pc.close();
    }
    peerConnections.clear();

    for (const [uid, audio] of remoteAudioElements) {
      audio.pause();
      audio.srcObject = null;
    }
    remoteAudioElements.clear();

    for (const [uid, nodes] of gainNodes) {
      nodes.ctx.close();
    }
    gainNodes.clear();
  }

  function cleanupLocalStream() {
    if (localStream) {
      for (const track of localStream.getTracks()) {
        track.stop();
      }
      localStream = null;
    }
    stopVAD();
  }

  // ===== Public API =====

  async function initiateCall(channelId: string) {
    const stream = await getMediaStream();
    if (!stream) return;

    localStream = stream;
    isMuted = false;
    isDeafened = false;
    speakingUsers = new Set();

    // Set up call state optimistically as ringing (outgoing)
    activeCall = {
      id: "", // Will be set by server
      channel_id: channelId,
      status: "ringing",
      participants: [],
    };

    wsClient.sendEvent("CALL_INITIATE", { channel_id: channelId });
  }

  async function acceptIncomingCall() {
    if (!incomingCall) return;

    const stream = await getMediaStream();
    if (!stream) {
      declineIncomingCall();
      return;
    }

    localStream = stream;
    isMuted = false;
    isDeafened = false;
    speakingUsers = new Set();

    wsClient.sendEvent("CALL_ACCEPT", { call_id: incomingCall.call_id });
    incomingCall = null;
  }

  function declineIncomingCall() {
    if (!incomingCall) return;
    wsClient.sendEvent("CALL_DECLINE", { call_id: incomingCall.call_id });
    incomingCall = null;
  }

  function leave() {
    if (!activeCall) return;
    wsClient.sendEvent("CALL_LEAVE", { call_id: activeCall.id });
    cleanupPeerConnections();
    cleanupLocalStream();
    // Don't null activeCall yet — wait for CALL_USER_LEFT to set rejoin state
  }

  async function rejoin() {
    if (!rejoinCallId) return;

    const stream = await getMediaStream();
    if (!stream) return;

    localStream = stream;
    isMuted = false;
    isDeafened = false;

    wsClient.sendEvent("CALL_REJOIN", { call_id: rejoinCallId });
  }

  function toggleMuteLocal() {
    if (!localStream || !activeCall) return;
    isMuted = !isMuted;
    for (const track of localStream.getAudioTracks()) {
      track.enabled = !isMuted;
    }
    wsClient.sendEvent("CALL_TOGGLE_MUTE", { call_id: activeCall.id });
  }

  function toggleDeafenLocal() {
    if (!activeCall) return;
    isDeafened = !isDeafened;
    if (isDeafened) {
      isMuted = true;
      if (localStream) {
        for (const track of localStream.getAudioTracks()) {
          track.enabled = false;
        }
      }
      wsClient.sendEvent("CALL_TOGGLE_MUTE", { call_id: activeCall.id });
    }
    // Mute/unmute all remote audio
    for (const audio of remoteAudioElements.values()) {
      audio.muted = isDeafened;
    }
    wsClient.sendEvent("CALL_TOGGLE_DEAFEN", { call_id: activeCall.id });
  }

  function setUserVolume(userId: string, volume: number) {
    userVolumes = { ...userVolumes, [userId]: volume };
    const nodes = gainNodes.get(userId);
    if (nodes) {
      nodes.gain.gain.value = volume / 100;
    }
  }

  async function switchInputDevice(deviceId: string) {
    inputDeviceId = deviceId;
    saveVoiceSettings({ inputDeviceId, outputDeviceId, inputSensitivity });

    if (!localStream || !activeCall) return;

    // Get new stream
    const newStream = await getMediaStream();
    if (!newStream) return;

    // Stop old tracks
    for (const track of localStream.getAudioTracks()) {
      track.stop();
    }

    // Replace tracks in all peer connections
    const newTrack = newStream.getAudioTracks()[0];
    for (const pc of peerConnections.values()) {
      const sender = pc.getSenders().find(s => s.track?.kind === "audio");
      if (sender) {
        await sender.replaceTrack(newTrack);
      }
    }

    localStream = newStream;
    if (!isMuted) {
      newTrack.enabled = true;
    }

    // Re-setup VAD
    stopVAD();
    setupVAD(newStream);
  }

  async function switchOutputDevice(deviceId: string) {
    outputDeviceId = deviceId;
    saveVoiceSettings({ inputDeviceId, outputDeviceId, inputSensitivity });

    for (const audio of remoteAudioElements.values()) {
      if ('setSinkId' in audio) {
        await (audio as any).setSinkId(deviceId).catch(() => {});
      }
    }
  }

  function setSensitivity(value: number) {
    inputSensitivity = value;
    saveVoiceSettings({ inputDeviceId, outputDeviceId, inputSensitivity });
  }

  async function enumerateDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      availableDevices = devices;
    } catch {}
  }

  // ===== WS Event Handlers =====

  function setupListeners() {
    unsubs.push(wsClient.on("CALL_RINGING", (data: any) => {
      // Someone is calling us
      incomingCall = {
        call_id: data.call_id,
        channel_id: data.channel_id,
        caller: data.caller,
        participants: data.participants,
      };
    }));

    unsubs.push(wsClient.on("CALL_STARTED", (data: any) => {
      incomingCall = null;
      activeCall = {
        id: data.call_id,
        channel_id: data.channel_id,
        status: "active",
        participants: data.participants,
      };

      canRejoin = false;
      rejoinCallId = null;
      if (rejoinTimeout) {
        clearTimeout(rejoinTimeout);
        rejoinTimeout = null;
      }

      // Setup VAD
      if (localStream) {
        setupVAD(localStream);
      }

      // Create peer connections with other participants
      const myId = auth.user?.id;
      if (myId) {
        for (const p of data.participants) {
          if (p.user_id !== myId) {
            const isOfferer = myId < p.user_id; // Deterministic
            createPeerConnection(p.user_id, isOfferer);
          }
        }
      }
    }));

    unsubs.push(wsClient.on("CALL_ENDED", (data: any) => {
      if (activeCall?.id === data.call_id || incomingCall?.call_id === data.call_id) {
        cleanupPeerConnections();
        cleanupLocalStream();
        activeCall = null;
        incomingCall = null;
        canRejoin = false;
        rejoinCallId = null;
        speakingUsers = new Set();
        if (rejoinTimeout) {
          clearTimeout(rejoinTimeout);
          rejoinTimeout = null;
        }
      }
    }));

    unsubs.push(wsClient.on("CALL_DECLINED", (_data: any) => {
      // Other user declined — end call if 1:1
      // Server handles this, we'll get CALL_ENDED
    }));

    unsubs.push(wsClient.on("CALL_USER_JOINED", (data: any) => {
      if (!activeCall || activeCall.id !== data.call_id) return;
      activeCall = { ...activeCall, participants: data.participants };

      // Create peer connection with new user
      const myId = auth.user?.id;
      if (myId && data.user?.id && data.user.id !== myId) {
        const isOfferer = myId < data.user.id;
        createPeerConnection(data.user.id, isOfferer);
      }
    }));

    unsubs.push(wsClient.on("CALL_USER_LEFT", (data: any) => {
      if (!activeCall || activeCall.id !== data.call_id) return;

      const myId = auth.user?.id;

      if (data.user_id === myId) {
        // We left — set rejoin state
        activeCall = null;
        canRejoin = data.can_rejoin || false;
        rejoinCallId = data.call_id;
        if (data.can_rejoin) {
          rejoinTimeout = setTimeout(() => {
            canRejoin = false;
            rejoinCallId = null;
            rejoinTimeout = null;
          }, (data.timeout_seconds || 180) * 1000);
        }
      } else {
        // Someone else left
        activeCall = {
          ...activeCall,
          participants: activeCall.participants.filter(p => p.user_id !== data.user_id),
        };
        // Cleanup their peer connection
        const pc = peerConnections.get(data.user_id);
        if (pc) {
          pc.close();
          peerConnections.delete(data.user_id);
        }
        const audio = remoteAudioElements.get(data.user_id);
        if (audio) {
          audio.pause();
          audio.srcObject = null;
          remoteAudioElements.delete(data.user_id);
        }
        const nodes = gainNodes.get(data.user_id);
        if (nodes) {
          nodes.ctx.close();
          gainNodes.delete(data.user_id);
        }
        // Remove from speaking
        const next = new Set(speakingUsers);
        next.delete(data.user_id);
        speakingUsers = next;
      }
    }));

    unsubs.push(wsClient.on("CALL_MUTE_UPDATE", (data: any) => {
      if (!activeCall || activeCall.id !== data.call_id) return;
      activeCall = {
        ...activeCall,
        participants: activeCall.participants.map(p =>
          p.user_id === data.user_id
            ? { ...p, is_muted: data.is_muted, is_deafened: data.is_deafened }
            : p
        ),
      };
    }));

    unsubs.push(wsClient.on("CALL_ERROR", (data: any) => {
      console.error("[voice] Call error:", data.error);
      // If we were trying to initiate, clean up
      if (activeCall?.status === "ringing" && !activeCall.id) {
        cleanupLocalStream();
        activeCall = null;
      }
    }));

    // WebRTC signaling
    unsubs.push(wsClient.on("RTC_OFFER", handleRtcOffer));
    unsubs.push(wsClient.on("RTC_ANSWER", handleRtcAnswer));
    unsubs.push(wsClient.on("RTC_ICE_CANDIDATE", handleIceCandidate));

    unsubs.push(wsClient.on("VOICE_SPEAKING", (data: any) => {
      if (data.speaking) {
        speakingUsers = new Set([...speakingUsers, data.user_id]);
      } else {
        const next = new Set(speakingUsers);
        next.delete(data.user_id);
        speakingUsers = next;
      }
    }));
  }

  function cleanup() {
    for (const unsub of unsubs) unsub();
    unsubs = [];
    cleanupPeerConnections();
    cleanupLocalStream();
    activeCall = null;
    incomingCall = null;
    canRejoin = false;
    rejoinCallId = null;
    speakingUsers = new Set();
  }

  return {
    get activeCall() { return activeCall; },
    get incomingCall() { return incomingCall; },
    get isMuted() { return isMuted; },
    get isDeafened() { return isDeafened; },
    get speakingUsers() { return speakingUsers; },
    get userVolumes() { return userVolumes; },
    get canRejoin() { return canRejoin; },
    get rejoinCallId() { return rejoinCallId; },
    get inputDeviceId() { return inputDeviceId; },
    get outputDeviceId() { return outputDeviceId; },
    get inputSensitivity() { return inputSensitivity; },
    get availableDevices() { return availableDevices; },

    initiateCall,
    acceptIncomingCall,
    declineIncomingCall,
    leave,
    rejoin,
    toggleMute: toggleMuteLocal,
    toggleDeafen: toggleDeafenLocal,
    setUserVolume,
    switchInputDevice,
    switchOutputDevice,
    setSensitivity,
    enumerateDevices,
    setupListeners,
    cleanup,
  };
}

export const voiceStore = createVoiceStore();
