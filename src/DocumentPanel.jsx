// src/DocumentPanel.jsx
import React, { useMemo, useState } from "react";
import { ethers } from "ethers";

const DOCREG = (process.env.REACT_APP_DOCREG_ADDRESS || "").trim();
const WEB3_TOKEN = (process.env.REACT_APP_WEB3_STORAGE_TOKEN || "").trim();

const regAbi = [
  "function registerDocument(uint256 orderId, uint8 docType, bytes32 sha256Hash, string uri) returns (uint256)",
  "function acceptDocument(uint256 orderId, uint256 index)",
  "function rejectDocument(uint256 orderId, uint256 index)",
  "function getDocsCount(uint256 orderId) view returns (uint256)",
  "function getDoc(uint256 orderId, uint256 index) view returns (uint8,bytes32,string,address,uint64,bool,address,bool)",
  "function isAccepted(uint256, uint8) view returns (bool)"
];

const DocType = { EBL:0, CommercialInvoice:1, PackingList:2, Certificate:3, Other:4 };

function bytesToHex(bytes) {
  return '0x' + Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2,'0')).join('');
}

export default function DocumentPanel() {
  const [orderId, setOrderId] = useState("");
  const [docType, setDocType] = useState(0);
  const [file, setFile] = useState(null);
  const [manualCid, setManualCid] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);
  const [docs, setDocs] = useState([]);
  const [eblAccepted, setEblAccepted] = useState(false);

  const provider = useMemo(() => new ethers.BrowserProvider(window.ethereum), []);
  const addLog = (s) => setLog(x => [...x, `[${new Date().toLocaleTimeString()}] ${s}`]);

  async function getReg(runner) { return new ethers.Contract(DOCREG, regAbi, runner); }

  async function refresh() {
    if (!orderId) return;
    try {
      setBusy(true); setLog([]);
      const reg = await getReg(provider);
      const n = Number(await reg.getDocsCount(orderId));
      const arr = [];
      for (let i=0; i<n; i++) {
        const [t, hash, uri, uploader, uploadedAt, accepted, acceptedBy, rejected] = await reg.getDoc(orderId, i);
        arr.push({ index:i, t, hash, uri, uploader, uploadedAt, accepted, acceptedBy, rejected });
      }
      setDocs(arr);
      setEblAccepted(await reg.isAccepted(orderId, DocType.EBL));
      addLog(`Loaded ${n} docs. eBL accepted = ${await reg.isAccepted(orderId, DocType.EBL)}`);
    } catch (e) { addLog("Refresh error: " + (e.message || String(e))); } finally { setBusy(false); }
  }

  async function uploadToWeb3(file) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("https://api.web3.storage/upload", {
      method:"POST",
      headers:{ Authorization:`Bearer ${WEB3_TOKEN}` },
      body: form
    });
    if (!res.ok) throw new Error(`upload failed: ${res.status} ${res.statusText}`);
    const j = await res.json();
    return `ipfs://${j.cid}`;
  }

  async function hashFile(theFile) {
    const buf = await theFile.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return bytesToHex(digest);
  }

  async function registerWithUpload() {
    try {
      if (!orderId) throw new Error("Enter orderId");
      if (!file) throw new Error("Choose a file");
      if (!WEB3_TOKEN) throw new Error("Missing REACT_APP_WEB3_STORAGE_TOKEN (or use 'Register with CID')");
      setBusy(true);
      await window.ethereum.request({ method: "eth_requestAccounts" });

      const hashHex = await hashFile(file);
      addLog("sha256(file) = " + hashHex);

      const uri = await uploadToWeb3(file);
      addLog("Uploaded to " + uri);

      const signer = await provider.getSigner(); const reg = await getReg(signer);
      addLog("Registering on-chain…");
      const tx = await reg.registerDocument(Number(orderId), Number(docType), hashHex, uri);
      addLog("register tx: " + tx.hash); await tx.wait(); addLog("registered.");
      await refresh();
    } catch (e) { addLog("Register error: " + (e.message || String(e))); } finally { setBusy(false); }
  }

  async function registerWithCid() {
    try {
      if (!orderId) throw new Error("Enter orderId");
      if (!file) throw new Error("Choose a file (to compute sha256)");
      if (!manualCid) throw new Error("Enter CID");
      setBusy(true);
      await window.ethereum.request({ method: "eth_requestAccounts" });

      const hashHex = await hashFile(file);
      addLog("sha256(file) = " + hashHex);

      const uri = manualCid.startsWith("ipfs://") ? manualCid : `ipfs://${manualCid.trim()}`;
      addLog("Using existing CID: " + uri);

      const signer = await provider.getSigner(); const reg = await getReg(signer);
      const tx = await reg.registerDocument(Number(orderId), Number(docType), hashHex, uri);
      addLog("register tx: " + tx.hash); await tx.wait(); addLog("registered.");
      await refresh();
    } catch (e) { addLog("Register (CID) error: " + (e.message || String(e))); } finally { setBusy(false); }
  }

  async function accept(index) { try { setBusy(true); const signer = await provider.getSigner(); const reg = await getReg(signer); const tx = await reg.acceptDocument(Number(orderId), Number(index)); addLog("accept tx: " + tx.hash); await tx.wait(); addLog("accepted."); await refresh(); } catch (e) { addLog("Accept error: " + (e.message || String(e))); } finally { setBusy(false); } }
  async function reject(index) { try { setBusy(true); const signer = await provider.getSigner(); const reg = await getReg(signer); const tx = await reg.rejectDocument(Number(orderId), Number(index)); addLog("reject tx: " + tx.hash); await tx.wait(); addLog("rejected."); await refresh(); } catch (e) { addLog("Reject error: " + (e.message || String(e))); } finally { setBusy(false); } }

  const canDirectUpload = Boolean(WEB3_TOKEN);

  return (
    <div style={{ marginTop:16, padding:16, border:"1px solid #eee", borderRadius:12 }}>
      <h2 style={{ margin:0, marginBottom:8 }}>Deal Documents</h2>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        <label>Order ID <input value={orderId} onChange={e=>setOrderId(e.target.value)} placeholder="e.g. 1" /></label>
        <label>Doc Type
          <select value={docType} onChange={e=>setDocType(Number(e.target.value))}>
            <option value={0}>eBL</option>
            <option value={1}>Commercial Invoice</option>
            <option value={2}>Packing List</option>
            <option value={3}>Certificate</option>
            <option value={4}>Other</option>
          </select>
        </label>
        <label>File (used to compute sha256) <input type="file" onChange={e=>setFile(e.target.files?.[0] || null)} /></label>
        {!canDirectUpload && (
          <label>CID (from console.web3.storage) <input value={manualCid} onChange={e=>setManualCid(e.target.value)} placeholder="bafy..." /></label>
        )}
      </div>

      <div style={{ marginTop:8, display:"flex", gap:8, flexWrap:"wrap" }}>
        <button onClick={refresh} disabled={busy || !orderId}>Refresh</button>
        {canDirectUpload ? (
          <>
            <button onClick={registerWithUpload} disabled={busy || !orderId || !file}>Upload + Register</button>
            <span style={{ color:"#666" }}>or</span>
            <input placeholder="Optional: paste CID to register without uploading" value={manualCid} onChange={e=>setManualCid(e.target.value)} style={{ width:260 }} />
            <button onClick={registerWithCid} disabled={busy || !orderId || !file || !manualCid}>Register with CID</button>
          </>
        ) : (
          <button onClick={registerWithCid} disabled={busy || !orderId || !file || !manualCid}>Register with CID</button>
        )}
        <div style={{ marginLeft:"auto", fontWeight:600 }}>eBL accepted: {eblAccepted ? "YES" : "NO"}</div>
      </div>

      <h3 style={{ marginTop:12 }}>Documents for Order {orderId || "—"}</h3>
      {docs.length === 0 ? <div>No documents.</div> : (
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr><th>#</th><th>Type</th><th>Hash (sha256)</th><th>URI</th><th>Uploader</th><th>Accepted</th><th>Rejected</th><th>Actions</th></tr></thead>
        <tbody>
          {docs.map(d => (
            <tr key={d.index} style={{ borderTop:"1px solid #eee" }}>
              <td>{d.index}</td>
              <td>{["eBL","Invoice","Packing","Cert","Other"][d.t] || d.t}</td>
              <td title={String(d.hash)}>{String(d.hash)}</td>
              <td title={d.uri}>
                {d.uri?.startsWith("ipfs://")
                  ? <a href={`https://w3s.link/ipfs/${d.uri.replace("ipfs://","")}`} target="_blank" rel="noreferrer">open</a>
                  : d.uri}
              </td>
              <td title={d.uploader}>{d.uploader.slice(0,10)}…</td>
              <td>{d.accepted ? "YES" : "NO"}</td>
              <td>{d.rejected ? "YES" : "NO"}</td>
              <td style={{ display:"flex", gap:6 }}>
                <button onClick={() => accept(d.index)} disabled={busy}>Accept</button>
                <button onClick={() => reject(d.index)} disabled={busy}>Reject</button>
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      )}

      <div style={{ marginTop:12 }}>
        <div style={{ fontWeight:700, marginBottom:4 }}>Log</div>
        <div style={{ whiteSpace:"pre-wrap", fontFamily:"monospace", border:"1px solid #eee", borderRadius:8, padding:8, maxHeight:200, overflowY:"auto", background:"#fafafa" }}>
          {log.length ? log.join("\n") : "No activity yet…"}
        </div>
      </div>
    </div>
  );
}

