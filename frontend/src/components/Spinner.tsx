export function Spinner() {
    return (
      <div
        style={{
          display: "inline-block",
          width: "20px",
          height: "20px",
          overflow: "hidden",
        }}
      >
        <div
          className="lds-spinner"
          role="status"
          aria-label="Loading"
          style={{
            transform: "scale(0.25)",   
            transformOrigin: "0 0",
          }}
        >
          <div></div><div></div><div></div><div></div>
          <div></div><div></div><div></div><div></div>
          <div></div><div></div><div></div><div></div>
        </div>
      </div>
    );
  }
  
  