import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navyDark: '#0D1B2A',
        navy: '#1B3A5C',
        navyLight: '#2A5080',
        navyBg: '#F0F5FA',

        accent: '#4A90C4',
        accentHover: '#2A5080',
        accentLight: '#6AADD5',
        accentText: '#1B3A5C',

        white: '#FFFFFF',
        offWhite: '#F0F5FA',
        pageBg: '#F0F5FA',
        surface: '#FFFFFF',
        surfaceHover: '#F7FAFD',
        grayCard: '#E8EEF5',

        bodyText: '#2A3A52',
        mutedText: '#6B7A99',
        hintText: '#8C99B3',

        borderSoft: '#D0DCE8',
        borderHover: '#AFC0D2',

        successBg: '#E6F4EF',
        successText: '#1B3A5C',
        successBorder: '#4A90C4',

        warningBg: '#FFF4D8',
        warningText: '#7A5A16',
        warningBorder: '#D9B65E',

        dangerBg: '#F5E8E8',
        dangerText: '#7A2E2E',
        dangerBorder: '#C46A6A',

        infoBg: '#F0F5FA',
        infoText: '#2A5080',
        infoBorder: '#6AADD5',
      },
      fontFamily: {
        sans: ['Calibri', 'Arial', 'Helvetica', 'sans-serif'],
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(13, 27, 42, 0.08), 0 1px 2px rgba(13, 27, 42, 0.04)',
        cardHover: '0 4px 12px rgba(13, 27, 42, 0.12), 0 2px 4px rgba(13, 27, 42, 0.06)',
        soft: '0 1px 3px rgba(13, 27, 42, 0.08)',
        dropdown: '0 8px 24px rgba(13, 27, 42, 0.14)',
      },
      fontSize: {
        '2xs': ['10px', '14px'],
      },
    },
  },
  plugins: [],
};

export default config;
