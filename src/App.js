import React, { useEffect, useState } from "react";
import NoWallet from "./NoWallet";
import { hasWallet, ensureSepolia } from "./provider";

import SupplierTest from "./SupplierTest";
import BuyerPanel from "./BuyerPanel";
import DocumentPanel from "./DocumentPanel";
import TraderPanel from "./TraderPanel";

export default function App() {
  const [walletOK, setWalletOK] = useState(false);
  const [netOK, setNetOK] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!hasWallet()) {
        if (mounted) { setWalletOK(false); setNetOK(false); setChecking(false); }
        return;
      }
      try {
        if (mounted) setWalletOK(true);
        const ok = await ensureSepolia();
        if (mounted) setNetOK(ok);
      } finally {
        if (mounted) setChecking(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (checking) return <div style={{ padding: 16, fontFamily: "Arial" }}><h2>Loading…</h2></div>;
  if (!walletOK) return <NoWallet />;
  if (!netOK) {
    return (
      <div style={{ padding: 16, fontFamily: "Arial" }}>
        <h2>Switch to Sepolia</h2>
        <p>Open MetaMask and switch to the Sepolia test network, then reload.</p>
        <button onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial", display: "grid", gap: 16 }}>
      <h1 style={{ marginBottom: 0 }}>✅ Tangent MVP</h1>
      <div style={{ color: "#555", marginBottom: 8 }}>Network: Sepolia (11155111)</div>

      {/* SUPPLIER */}
      <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>Supplier</h2>
        <SupplierTest />
      </div>

      {/* BUYER */}
      <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>Buyer</h2>
        <BuyerPanel />
      </div>

      {/* DEAL DOCUMENTS */}
      <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>Deal Documents</h2>
        <DocumentPanel />
      </div>

      {/* TRADER */}
      <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>Trader</h2>
        <TraderPanel />
      </div>
    </div>
  );
}







