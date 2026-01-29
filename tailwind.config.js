/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./views/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            colors: {
                primary: '#ED1C24',
                secondary: '#F2F2F7', // iOS System Gray 6
                surface: '#FFFFFF',
                iosText: '#1C1C1E',
                iosGray: '#8E8E93',
            },
            boxShadow: {
                'ios': '0 4px 20px rgba(0, 0, 0, 0.05)',
                'ios-card': '0 2px 10px rgba(0, 0, 0, 0.03)',
            }
        },
    },
    plugins: [],
}
