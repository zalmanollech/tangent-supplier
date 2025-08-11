// src/VaultInspector.jsx
import { useEffect, useState } from "react";
import { ethers } from "ethers";

function labelChain(hexId) {
  const id = parseInt(hexId, 16);
  if (id === 1) return "Mainnet";
  if (id === 11155111) return "Sepolia";
  return `Chain ${id}`;
}

export default function VaultInspector() {
  const [info, setInfo] = useState({
    status: "idle",
    chainIdHex: null,
    chainName: "",
    vaultAddr: process.env.REACT_APP_VAULT_ADDRESS?.trim() || "",
    tgtAddr: process.env.REACT_APP_TGT_ADDRESS?.trim() || "",
    bytecodeLen: null,
    detectedMethod: null,
    underlyingAddr: null,
    notes: [],
    error: null,
  });

  async function run() {
    try {
      if (!window.ethereum) throw new Error("No wallet found (MetaMask). Open it in this browser.");

      setInfo((s) => ({ ...s, status: "connecting", error: null, notes: [] }));

      // 1) Connect wallet
      await window.ethereum.request({ method: "eth_requestAccounts" });

      // 2) Ensure Sepolia
      let chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
      if (chainIdHex !== "0xaa36a7") {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0xaa36a7" }],
          });
          chainIdHex = "0xaa36a7";
        } catch (e) {
          if (e && e.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: "0xaa36a7",
                chainName: "Sepolia",
                nativeCurrency: { name: "Sepolia ETH", symbol: "SEP", decimals: 18 },
                rpcUrls: ["https://sepolia.gateway.tenderly.co"],
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              }],
            });
            chainIdHex = "0xaa36a7";
          } else {
            throw new Error("Please switch network to Sepolia in MetaMask.");
          }
        }
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const vaultAddr = process.env.REACT_APP_VAULT_ADDRESS?.trim();
      const tgtAddr = process.env.REACT_APP_TGT_ADDRESS?.trim();

      const code = await provider.getCode(vaultAddr);
      const notes = [];
      notes.push(`Connected to ${labelChain(chainIdHex)} (${chainIdHex}).`);
      notes.push(`VAULT at ${vaultAddr}`);
      notes.push(`TGT at ${tgtAddr}`);

      if (!code || code === "0x") {
        setInfo((s) => ({
          ...s,
          status: "done",
          chainIdHex,
          chainName: labelChain(chainIdHex),
          bytecodeLen: 0,
          detectedMethod: null,
          underlyingAddr: null,
          notes,
          error: "No contract code at VAULT on this network. Check address/network.",
        }));
        return;
      }

      const abi = [
        "function token() view returns (address)",
        "function asset() view returns (address)",
        "function underlying() view returns (address)",
      ];
      const vault = new ethers.Contract(vaultAddr, abi, provider);

      const probes = [
        { name: "token", fn: () => vault.token() },
        { name: "asset", fn: () => vault.asset() },
        { name: "underlying", fn: () => vault.underlying() },
      ];

      let detectedMethod = null;
      let underlyingAddr = null;

      for (const p of probes) {
        try {
          const addr = await p.fn();
          if (addr && ethers.isAddress(addr) && addr !== ethers.ZeroAddress) {
            detectedMethod = p.name;
            underlyingAddr = ethers.getAddress(addr);
            break;
          }
        } catch {
          // try next
        }
      }

      if (!underlyingAddr) {
        notes.push("Could not detect token/asset/underlying; falling back to TGT.");
        underlyingAddr = tgtAddr;
      } else {
        notes.push(`Detected method: ${detectedMethod}() -> ${underlyingAddr}`);
      }

      setInfo((s) => ({
        ...s,
        status: "done",
        chainIdHex,
        chainName: labelChain(chainIdHex),
        bytecodeLen: code.length,
        detectedMethod,
        underlyingAddr,
        notes,
        error: null,
      }));
    } catch (err) {
      setInfo((s) => ({
        ...s,
        status: "error",
        error: err?.message || String(err),
      }));
    }
  }

  useEffect(() => { run(); /* eslint-disable-next-line */ }, []);

  return (
    <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 12, marginTop: 16 }}>
      <h2 style={{ margin: 0, marginBottom: 8 }}>Vault Inspector</h2>
      <div>Status: <b>{info.status}</b></div>
      {info.chainIdHex && <div>Network: <b>{info.chainName}</b> ({info.chainIdHex})</div>}
      <div style={{ marginTop: 8 }}>
        <div><b>VAULT:</b> {info.vaultAddr}</div>
        <div><b>TGT:</b> {info.tgtAddr}</div>
        {info.bytecodeLen !== null && <div>VAULT bytecode length: {info.bytecodeLen}</div>}
        {info.detectedMethod && <div>Detected method: <code>{info.detectedMethod}()</code></div>}
        {info.underlyingAddr && <div>Underlying token address: <b>{info.underlyingAddr}</b></div>}
        {info.notes?.length > 0 && <ul>{info.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
        {info.error && <div style={{ color: "crimson", marginTop: 8 }}>Error: {info.error}</div>}
        <button onClick={run} style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8 }}>
          Re-run
        </button>
      </div>
    </div>
  );
}
