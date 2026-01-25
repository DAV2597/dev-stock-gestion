import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('/service-worker.js').then(registration => {
//       console.log('SW registered: ', registration);
//     }).catch(registrationError => {
//       console.log('SW registration failed: ', registrationError);
//     });
//   });
// }

// commende pour convertir l'application react js en mobile, ce du react js avec firebase je veux directement heberger sur firebase donne toutes ce commandes dans un bloc je veux copier une fois pour toutes et coller toutes ce commande en meme tant,ne met pas de commentaire a l'interieur
// npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
// npx cap init "Mon App" com.monapp.id --web-dir dist
// npm run build
// npx cap add android
// npx cap copy
// firebase login
// firebase init hosting
// firebase deploy
// npx cap open android