/** @type {import('tailwindcss').Config} */
module.exports = {
  
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        green: "#B9FF66",
        greenBorder: "#9FE84B",
        text: "#141414",
        muted: "#6f6f6f",
        border: "#e9e9e9",
      },
      fontFamily: {
        poppins: ["Poppins", "system-ui", "sans-serif" ],
        nunito: ["Nunito", "sans-serif"],
        lora: ["Lora", "serif"],

      },
      keyframes: {
        slideIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        slideIn: "slideIn .55s cubic-bezier(.2,.8,.2,1) both",
        fadeUp: "fadeUp .65s cubic-bezier(.2,.8,.2,1) both",
      },
      boxShadow: {
        input: "0 2px 10px rgba(0,0,0,.04)",
        greenSoft: "0 10px 22px rgba(185,255,102,.40)",
        greenHover: "0 16px 30px rgba(185,255,102,.52)",
        greenBtn: "0 14px 26px rgba(185,255,102,.42)",
        greenBtnHover: "0 18px 34px rgba(185,255,102,.55)",
      },
    },
  },
  
  plugins: [],
};

