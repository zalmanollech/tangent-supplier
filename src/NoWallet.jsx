// src/NoWallet.jsx
import React from "react";

export default function NoWallet() {
  return (
    <div style={{ padding: "2rem", fontFamily: "Arial", maxWidth: 720 }}>
      <h2>🔌 Wallet not detected</h2>
      <p>This app needs a Web3 wallet (MetaMask).</p>
      <ol>
        <li>
          Install <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">MetaMask</a> in your browser.
        </li>
        <li>Reload this page.</li>
        <li>When prompted, switch network to <b>Sepolia</b>.</li>
      </ol>
      <p style={{ color: "#555" }}>
        On mobile, open this site inside the MetaMask in-app browser.
      </p>
    </div>
  );
}
