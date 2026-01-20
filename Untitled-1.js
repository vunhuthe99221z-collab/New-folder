
    const MyComponent = () => {
      useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://qaas.soquest.xyz/onboarding/static/js/onboard.js';
        script.defer = true;
        script.onload = () => {
          if (typeof window !== 'undefined' && window.updateStyles) {
            window.updateStyles();
          }
        };
    
        document.body.appendChild(script);
    
        return () => {
          document.body.removeChild(script);
        };
      }, []);
    
      return (
        <div
          className="SoQuest-Widget-OnBoard"
          data-mode="dark"
          data-color="#30302F"
          data-key="9eff98ffb95fa2bbaf540ab23c48e68f1836"
          data-scode="port3network"
          data-ccode="DpuLQru2Yt"
        ></div>
      );
    };
  
  