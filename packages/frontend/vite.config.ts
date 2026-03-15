import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		host: true,
		proxy: {
			'/api': 'http://localhost:3000',
			'/uploads': 'http://localhost:3000',
			'/ws': { target: 'ws://localhost:3000', ws: true }
		}
	}
});
