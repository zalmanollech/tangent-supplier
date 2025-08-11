// src/TraderPanel.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { ethers } from "ethers";

const ORDERBOOK = (process.env.REACT_APP_ORDERBOOK_ADDRESS || "").trim();
const DOCREG = (process.env.REACT_APP_DOCREG_ADDRESS || "").trim();

const orderbookAbi = [
  "function nextOrderId() view returns (uint256)",
  "function orders(uint256) view returns (address buyer,address seller,address payToken,uint256 payAmount,address assetToken,uint256 assetAmount,bool filled,bool canceled)",
  "function fillOrder(uint256 id)",
];

const regAbi = ["function isAccepted(uint256 orderId, uint8 docType) view returns (bool)"];
const erc20Abi = [
  "function decimals() view returns(uint8)",
  "function allowance(address owner,address spender) view returns(uint256)",
  "function approve(address spender,uint256 amount) returns(bool)",
];

const DocType = { EBL: 0 };

// tuple -> plain object (ethers v6 Result safe)
function normalizeOrder(o) {
  return {
    buyer:       o?.buyer       ?? o?.[0],
    seller:      o?.seller      ?? o?.[1],
    payToken:    o?.payToken    ?? o?.[2],
    payAmount:   o?.payAmount   ?? o?.[3],
    assetToken:  o?.assetToken  ?? o?.[4],
    assetAmount: o?.assetAmount ?? o?.[5],
    filled:      o?.filled      ?? o?.[6],
    canceled:    o?.canceled    ?? o?.[7],
  };
}

function fmtUnitsSafe(v, d) {
  try { return Number(ethers.formatUnits(v ?? 0n, d || 18)).toLocaleString(undefined, { maximumFractionDigits: 6 }); }
  catch { return String(v ?? "0"); }
}

export default function TraderPanel() {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);
  const [orders, setOrders] = useState([]);
  const [decimalsMap, setDecimalsMap] = useState({});
  const [eblReady, setEblReady] = useState({});

  const provider = useMemo(() => new ethers.BrowserProvider(window.ethereum), []);

  const addLog = useCallback((s) => {
    setLog((x) => [...x, `[${new Date().toLocaleTimeString()}] ${s}`]);
  }, []);

  const getOB = useCallback(
    (runner) => new ethers.Contract(ORDERBOOK, orderbookAbi, runner),
    []
  );
  const getReg = useCallback(
    (runner) => new ethers.Contract(DOCREG, regAbi, runner),
    []
  );

  const ensureDecimals = useCallback(
    async (token) => {
      if (!token || !ethers.isAddress(token)) return 18;
      if (decimalsMap[token]) return decimalsMap[token];
      try {
        const erc20 = new ethers.Contract(token, erc20Abi, provider);
        const d = await erc20.decimals().catch(() => 18);
        setDecimalsMap((m) => ({ ...m, [token]: Number(d) }));
        return Number(d);
      } catch {
        setDecimalsMap((m) => ({ ...m, [token]: 18 }));
        return 18;
      }
    },
    [provider, decimalsMap]
  );

  const refresh = useCallback(async () => {
    try {
      setBusy(true);
      setLog([]);
      await window.ethereum.request({ method: "eth_requestAccounts" });

      const ob = getOB(provider);
      const reg = getReg(provider);

      const n = await ob.nextOrderId();
      const last = Number(n);
      const arr = [];
      const eMap = {};
      for (let i = Math.max(0, last - 100); i < last; i++) {
        const raw = await ob.orders(i);
        const o = normalizeOrder(raw);
        if (!o || o.buyer === undefined) continue; // skip malformed
        if (!o.filled && !o.canceled && o.buyer !== ethers.ZeroAddress) {
          arr.push({ id: i, ...o });
          await ensureDecimals(o.payToken);
          await ensureDecimals(o.assetToken);
          try {
            eMap[i] = await reg.isAccepted(i, DocType.EBL);
          } catch {
            eMap[i] = false;
          }
        }
      }
      setOrders(arr);
      setEblReady(eMap);
      addLog(`Loaded ${arr.length} open orders (eBL gate checked).`);
    } catch (e) {
      addLog("Refresh error: " + (e.message || String(e)));
    } finally {
      setBusy(false);
    }
  }, [provider, getOB, getReg, ensureDecimals, addLog]);

  async function fill(id, assetToken, assetAmount, sellerLock) {
    try {
      setBusy(true);
      const signer = await provider.getSigner();
      const me = await signer.getAddress();

      if (sellerLock && sellerLock !== ethers.ZeroAddress && sellerLock.toLowerCase() !== me.toLowerCase()) {
        throw new Error("Order locked for a different seller");
      }
      if (!eblReady[id]) throw new Error("eBL not accepted for this order yet");

      const token = assetToken;
      const erc20 = new ethers.Contract(token, erc20Abi, signer);
      const cur = await erc20.allowance(me, ORDERBOOK);
      if (cur < (assetAmount ?? 0n)) {
        addLog("Approving asset…");
        const txA = await erc20.approve(ORDERBOOK, assetAmount ?? 0n);
        addLog("approve tx: " + txA.hash);
        await txA.wait();
        addLog("approve confirmed.");
      }

      const ob = getOB(signer);
      addLog("Filling order " + id + "…");
      const tx = await ob.fillOrder(id);
      addLog("fill tx: " + tx.hash);
      const rc = await tx.wait();
      addLog("order filled in block " + rc.blockNumber);
      await refresh();
    } catch (e) {
      addLog("Fill error: " + (e.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div style={{ marginTop: 16, padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
      <h2 style={{ margin: 0, marginBottom: 8 }}>Trader Panel</h2>

      <div style={{ marginBottom: 8, display: "flex", gap: 8 }}>
        <button onClick={refresh} disabled={busy}>Refresh</button>
      </div>

      {orders.length === 0 ? (
        <div>No open orders in the recent range.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">ID</th>
              <th align="left">Buyer</th>
              <th align="left">Pay → Trader</th>
              <th align="left">Deliver → Buyer</th>
              <th align="left">Seller Lock</th>
              <th align="left">eBL</th>
              <th align="left">Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const dPay = decimalsMap[o.payToken] || 18;
              const dAsset = decimalsMap[o.assetToken] || 18;
              const ok = !!eblReady[o.id];

              const buyerShort = typeof o.buyer === "string" ? `${o.buyer.slice(0,10)}…` : "—";
              const payShort = typeof o.payToken === "string" ? `${o.payToken.slice(0,6)}…` : "—";
              const assetShort = typeof o.assetToken === "string" ? `${o.assetToken.slice(0,6)}…` : "—";
              const sellerShort =
                typeof o.seller === "string"
                  ? (o.seller === ethers.ZeroAddress ? "any" : `${o.seller.slice(0,10)}…`)
                  : "—";

              return (
                <tr key={o.id} style={{ borderTop: "1px solid #eee" }}>
                  <td>{o.id}</td>
                  <td title={typeof o.buyer === "string" ? o.buyer : ""}>{buyerShort}</td>
                  <td title={typeof o.payToken === "string" ? o.payToken : ""}>
                    {payShort} {fmtUnitsSafe(o.payAmount, dPay)}
                  </td>
                  <td title={typeof o.assetToken === "string" ? o.assetToken : ""}>
                    {assetShort} {fmtUnitsSafe(o.assetAmount, dAsset)}
                  </td>
                  <td>{sellerShort}</td>
                  <td style={{ color: ok ? "#0a0" : "#a00", fontWeight: 600 }}>{ok ? "ACCEPTED" : "PENDING"}</td>
                  <td>
                    <button
                      onClick={() => fill(o.id, o.assetToken, o.assetAmount, o.seller)}
                      disabled={busy || !ok || !ethers.isAddress(o.assetToken)}
                    >
                      Fill
                    </button>
                  </td>
                </tr>
              );
            })}
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

