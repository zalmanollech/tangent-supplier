import React from "react";
import SupplierTest from "./SupplierTest";   // your working vault UI
import BuyerPanel from "./BuyerPanel";
import TraderPanel from "./TraderPanel";
import DocumentPanel from "./DocumentPanel";

export default function App() {
  return (
    <div style={{ padding: "2rem", fontFamily: "Arial" }}>
      <h1>✅ Tangent MVP</h1>
      <p>Supplier (Vault), Buyer (Orders), Trader (Fills), Documents (eBL & others)</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        <SupplierTest />
        <BuyerPanel />
        <TraderPanel />
        <DocumentPanel />
      </div>
    </div>
  );
}




