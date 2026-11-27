import React from "react";
import ReactDOM from "react-dom/client";

function App() {
  return <main style={{fontFamily:"system-ui",padding:"3rem",maxWidth:760,margin:"auto"}}><h1>Fana Cafe</h1><p>React frontend foundation. Existing storefront and dashboards will be ported in migration phases.</p><p>Configure the backend URL to connect this app to FastAPI.</p></main>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
