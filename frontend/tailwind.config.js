/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    safelist: [
        'hidden',
        'flex',
        'md:flex',
        'md:hidden',
        'md:w-sidebar',
        'md:w-analytics',
        'md:shrink-0',
        'md:border-r',
        'md:border-l',
        'md:pb-4',
        'md:flex-row',
        'md:min-w-[350px]',
    ],
    theme: {
        extend: {},
    },
    plugins: [],
}
