import { z } from "zod";
import { FRIEND_REQUEST_NOTE_MAX_LENGTH } from "./constants";

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username must be at most 32 characters")
    .regex(
      /^[a-z0-9_.]+$/,
      "Username can only contain lowercase letters, numbers, underscores, and periods"
    ),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const sendFriendRequestSchema = z.object({
  username: z.string().min(3).max(32),
  note: z
    .string()
    .max(FRIEND_REQUEST_NOTE_MAX_LENGTH, `Note must be at most ${FRIEND_REQUEST_NOTE_MAX_LENGTH} characters`)
    .optional()
    .nullable(),
});

export const updateUserSettingsSchema = z.object({
  allow_friend_request_notes: z.boolean().optional(),
});

export const updateProfileSchema = z.object({
  display_name: z
    .string()
    .max(50, "Display name must be at most 50 characters")
    .optional()
    .nullable(),
  bio: z
    .string()
    .max(300, "Bio must be at most 300 characters")
    .optional(),
  pronouns: z
    .string()
    .max(40, "Pronouns must be at most 40 characters")
    .optional(),
  avatar_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid color format")
    .optional(),
  links: z
    .array(
      z.object({
        label: z.string().max(50, "Label must be at most 50 characters"),
        url: z.string().url("Invalid URL").max(500, "URL must be at most 500 characters"),
      })
    )
    .max(5, "Maximum 5 links allowed")
    .optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SendFriendRequestInput = z.infer<typeof sendFriendRequestSchema>;
export type UpdateUserSettingsInput = z.infer<typeof updateUserSettingsSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
