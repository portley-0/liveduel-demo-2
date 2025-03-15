import type { Config } from "tailwindcss";
import "daisyui";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",        
    "./pages/**/*.{js,ts,jsx,tsx}",    
    "./components/**/*.{js,ts,jsx,tsx}",
    "./styles/**/*.{css,scss}",          
  ],
  theme: {
    extend: {
      colors: {
        'darkblue': 'rgb(0, 0, 30)', 
        'redmagenta': 'rgb(225, 29, 72)',
        'greyblue': 'rgb(30, 41, 60)',
        'hovergreyblue': 'rgb(45, 55, 75)',
        'lightgreyblue': 'rgb(50, 65, 85)',
        'pinkred': 'rgb(255, 88, 98)'
      },
    }, 
    aspectRatio: {
      '4/5': '4 / 5',
    },
  },
  plugins: [
    require('daisyui'),]
};

export default config;
