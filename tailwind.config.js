/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  prefix: 'x-',
  important: true,
  corePlugins: {
    preflight: false, // 关闭 Tailwind 默认样式清除，防止破坏网页原有样式
  },
  theme: {
    extend: {},
  },
  plugins: [],
}