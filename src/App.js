import React, { useEffect, useState } from "react";
import NoWallet from "./NoWallet";
import { hasWallet, ensureSepolia } from "./provider";

// If you have these panels, they’ll render when wallet + network are ready.
// If not, you can temporarily comment them and keep SupplierTest instead.
import BuyerPanel from "./BuyerPanel";
import TraderPanel from "./TraderPanel";
import DocumentPanel from "./DocumentPanel";
// import SupplierTest from "./SupplierTest";

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
      } catch {
        if (mounted) setNetOK(false);
      } finally {
        if (mounted) setChecking(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (checking) {
    return (
      <div style={{ padding: "2rem", fontFamily: "Arial" }}>
        <h2>Loading…</h2>
      </div>
    );
  }

  if (!walletOK) return <NoWallet />;

  if (!netOK) {
    return (
      <div style={{ padding: "2rem", fontFamily: "Arial" }}>
        <h2>Switch to Sepolia</h2>
        <p>We tried to switch your wallet to the Sepolia test network. If it didn’t pop up, open MetaMask and switch manually.</p>
        <button onClick={() => window.location.reload()}>I switched — Reload</button>
      </div>
    );
  }

  // Wallet + network are ready -> render the app
  return (
    <div style={{ padding: "2rem", fontFamily: "Arial", display: "grid", gap: 16 }}>
      <h1 style={{ marginBottom: 0 }}>✅ Tangent MVP</h1>
      <div style={{ color: "#555", marginBottom: 8 }}>Network: Sepolia (11155111)</div>

      {/* If you still want the basic supplier panel, uncomment below */}
      {/* <SupplierTest /> */}

      <BuyerPanel />
      <DocumentPanel />
      <TraderPanel />
    </div>
  );
}





