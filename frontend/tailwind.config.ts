/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",        // Include all files in the `app` directory
    "./routes/**/*.{js,ts,jsx,tsx}",     // Include all files in the `routes` directory
    "./components/**/*.{js,ts,jsx,tsx}", // Include all files in the `components` directory
    "./styles/**/*.{css,scss}",          // Include all styles files (CSS or SCSS)
  ],
  theme: {
    extend: {
      colors: {
        'darkblue': 'rgb(0, 0, 30)', 
        'redmagenta': 'rgb(225, 29, 72)',
        'greyblue': 'rgb(30, 41, 60)',
        'hovergreyblue': 'rgb(40, 51, 70)',
        'lightgreyblue': 'rgb(50, 65, 85)',
        'pinkred': 'rgb(255, 88, 98)'
      },
    }, 
    aspectRatio: {
      '4/5': '4 / 5',
    },
  },
  plugins: [require("daisyui")], // Add DaisyUI as a plugin
};

