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
        'redmagenta': 'rgb(240, 50, 80)',
        'greyblue': 'rgb(30, 41, 60)',
        'hovergreyblue': 'rgb(45, 55, 75)',
        'lightgreyblue': 'rgb(50, 65, 85)',
        'pinkred': 'rgb(255, 88, 98)'
      },
    },
    screens: {
      xxs: "350px", 
      xs: "380px",  
      sm: "430px", 
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    aspectRatio: {
      '4/5': '4 / 5',
    },
  },
  plugins: [
    require('daisyui'),]
};

export default config;
