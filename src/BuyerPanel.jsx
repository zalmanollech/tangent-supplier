// src/BuyerPanel.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { ethers } from "ethers";

const ORDERBOOK = (process.env.REACT_APP_ORDERBOOK_ADDRESS || "").trim();
const TGT = (process.env.REACT_APP_TGT_ADDRESS || "").trim();

const orderbookAbi = [
  "function createOrder(address seller, address payToken, uint256 payAmount, address assetToken, uint256 assetAmount) returns (uint256)",
  "function cancelOrder(uint256 id)",
  "function nextOrderId() view returns (uint256)",
  "function orders(uint256) view returns (address buyer,address seller,address payToken,uint256 payAmount,address assetToken,uint256 assetAmount,bool filled,bool canceled)",
];

const erc20Abi = [
  "function decimals() view returns(uint8)",
  "function balanceOf(address) view returns(uint256)",
  "function allowance(address owner,address spender) view returns(uint256)",
  "function approve(address spender,uint256 amount) returns(bool)",
];

function fmt(v, d) {
  try {
    return Number(ethers.formatUnits(v, d)).toLocaleString(undefined, {
      maximumFractionDigits: 6,
    });
  } catch {
    return v?.toString?.() ?? String(v);
  }
}

// Normalize ethers Result tuple -> plain object
function normalizeOrder(o) {
  return {
    buyer:       o.buyer       ?? o[0],
    seller:      o.seller      ?? o[1],
    payToken:    o.payToken    ?? o[2],
    payAmount:   o.payAmount   ?? o[3],
    assetToken:  o.assetToken  ?? o[4],
    assetAmount: o.assetAmount ?? o[5],
    filled:      o.filled      ?? o[6],
    canceled:    o.canceled    ?? o[7],
  };
}

export default function BuyerPanel() {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);
  const [orders, setOrders] = useState([]);
  const [decimals, setDecimals] = useState(18);

  // form
  const [seller, setSeller] = useState("");
  const [payToken, setPayToken] = useState(TGT);
  const [payAmount, setPayAmount] = useState("10");
  const [assetToken, setAssetToken] = useState(TGT);
  const [assetAmount, setAssetAmount] = useState("10");

  const provider = useMemo(() => new ethers.BrowserProvider(window.ethereum), []);

  const addLog = useCallback((s) => {
    setLog((x) => [...x, `[${new Date().toLocaleTimeString()}] ${s}`]);
  }, []);

  const getOB = useCallback(
    (runner) => new ethers.Contract(ORDERBOOK, orderbookAbi, runner),
    []
  );
  const getERC20 = useCallback(
    (addr, runner) => new ethers.Contract(addr, erc20Abi, runner),
    []
  );

  const refresh = useCallback(async () => {
    try {
      setBusy(true);
      setLog([]);
      await window.ethereum.request({ method: "eth_requestAccounts" });

      const ob = getOB(provider);
      const signer = await provider.getSigner();
      const me = await signer.getAddress();

      // infer decimals from payToken for formatting
      try {
        const d = await getERC20(payToken, provider).decimals();
        setDecimals(Number(d));
      } catch {
        setDecimals(18);
      }

      const n = await ob.nextOrderId();
      const last = Number(n);
      const arr = [];
      for (let i = Math.max(0, last - 50); i < last; i++) {
        const raw = await ob.orders(i);
        const o = normalizeOrder(raw);
        if (o.buyer && o.buyer !== ethers.ZeroAddress) {
          arr.push({ id: i, ...o });
        }
      }

      const mine = arr.filter(
        (o) => typeof o.buyer === "string" && o.buyer.toLowerCase() === me.toLowerCase()
      );
      setOrders(mine);

      addLog(`Loaded ${arr.length} recent orders; showing ${mine.length} of yours.`);
    } catch (e) {
      addLog("Refresh error: " + (e.message || String(e)));
    } finally {
      setBusy(false);
    }
  }, [provider, payToken, getOB, getERC20, addLog]);

  async function create() {
    try {
      setBusy(true);
      const signer = await provider.getSigner();
      const me = await signer.getAddress();
      const ob = getOB(signer);
      const pay = getERC20(payToken, signer);

      const d = decimals || (await pay.decimals().catch(() => 18));
      const amt = ethers.parseUnits(String(payAmount || "0"), d);
      const assetAmt = ethers.parseUnits(String(assetAmount || "0"), d);
      if (amt <= 0n || assetAmt <= 0n) throw new Error("amounts must be > 0");

      const cur = await pay.allowance(me, ORDERBOOK);
      if (cur < amt) {
        addLog(`Approving ${fmt(amt, d)} to ORDERBOOK…`);
        const txA = await pay.approve(ORDERBOOK, amt);
        addLog(`approve tx: ${txA.hash}`);
        await txA.wait();
        addLog(`approve confirmed.`);
      }

      addLog(`Creating order…`);
      const tx = await ob.createOrder(
        seller && seller.trim() !== "" ? seller.trim() : ethers.ZeroAddress,
        payToken.trim(),
        amt,
        assetToken.trim(),
        assetAmt
      );
      addLog(`create tx: ${tx.hash}`);
      const rc = await tx.wait();
      addLog(`order created in block ${rc.blockNumber}.`);
      await refresh();
    } catch (e) {
      addLog("Create error: " + (e.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id) {
    try {
      setBusy(true);
      const signer = await provider.getSigner();
      const ob = getOB(signer);
      const tx = await ob.cancelOrder(id);
      addLog(`cancel tx: ${tx.hash}`);
      await tx.wait();
      addLog(`order ${id} canceled.`);
      await refresh();
    } catch (e) {
      addLog("Cancel error: " + (e.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div style={{ marginTop: 16, padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
      <h2 style={{ margin: 0, marginBottom: 8 }}>Buyer Panel</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label>Seller (optional):
          <input value={seller} onChange={e=>setSeller(e.target.value)} placeholder="0x… or empty" style={{ width:"100%" }}/>
        </label>
        <label>Pay Token:
          <input value={payToken} onChange={e=>setPayToken(e.target.value)} style={{ width:"100%" }}/>
        </label>
        <label>Pay Amount:
          <input type="number" step="0.000001" value={payAmount} onChange={e=>setPayAmount(e.target.value)} style={{ width:"100%" }}/>
        </label>
        <label>Asset Token:
          <input value={assetToken} onChange={e=>setAssetToken(e.target.value)} style={{ width:"100%" }}/>
        </label>
        <label>Asset Amount:
          <input type="number" step="0.000001" value={assetAmount} onChange={e=>setAssetAmount(e.target.value)} style={{ width:"100%" }}/>
        </label>
      </div>

      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button onClick={refresh} disabled={busy}>Refresh</button>
        <button onClick={create} disabled={busy}>Create Order</button>
      </div>

      <h3 style={{ marginTop: 16 }}>Your Orders</h3>
      <div style={{ fontSize: 12, color: "#666" }}>Only your last ~50 listed.</div>
      {orders.length === 0 ? (
        <div style={{ marginTop: 8 }}>No recent orders.</div>
      ) : (
        <table style={{ width: "100%", marginTop: 8, borderCollapse: "collapse" }}>
          <thead><tr><th align="left">ID</th><th align="left">Status</th><th align="left">Pay</th><th align="left">For</th><th align="left">Seller</th><th align="left">Actions</th></tr></thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id} style={{ borderTop: "1px solid #eee" }}>
                <td>{o.id}</td>
                <td>{o.filled ? "FILLED" : o.canceled ? "CANCELED" : "OPEN"}</td>
                <td>{o.payToken.slice(0,6)}… {fmt(o.payAmount, decimals)}</td>
                <td>{o.assetToken.slice(0,6)}… {fmt(o.assetAmount, decimals)}</td>
                <td>{o.seller === ethers.ZeroAddress ? "any" : o.seller.slice(0,10)+"…"}</td>
                <td>{!o.filled && !o.canceled ? <button onClick={() => cancel(o.id)} disabled={busy}>Cancel</button> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Log</div>
        <div style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", border: "1px solid #eee", borderRadius: 8, padding: 8, maxHeight: 200, overflowY: "auto", background: "#fafafa" }}>
          {log.length ? log.join("\n") : "No activity yet…"}
        </div>
      </div>
    </div>
  );
}

