// src/SupplierTest.jsx
import React, { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";

/**
 * SupplierTest for SimpleVault (deposit/withdraw supported)
 * Env vars:
 *   REACT_APP_VAULT_ADDRESS=0x928b1b90B7d5b0f4e3502002C45eE3Df3dabb7ce
 *   REACT_APP_TGT_ADDRESS=0x06d6C1c578e6c9dd801c65821BBDF4eCb5be5325
 */

const VAULT_ADDR = (process.env.REACT_APP_VAULT_ADDRESS || "").trim();
const TGT_ADDR = (process.env.REACT_APP_TGT_ADDRESS || "").trim();
const SEPOLIA_HEX = "0xaa36a7";

function fmt(v, d) {
  try {
    return Number(ethers.formatUnits(v, d)).toLocaleString(undefined, {
      maximumFractionDigits: 6,
    });
  } catch {
    return v && v.toString ? v.toString() : String(v);
  }
}

export default function SupplierTest() {
  const [net, setNet] = useState({ chainIdHex: "", name: "" });
  const [decimals, setDecimals] = useState(18);
  const [balances, setBalances] = useState({
    userTgt: null,
    vaultTgt: null,
    userShares: null,
  });
  const [amount, setAmount] = useState("0.10");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);

  const provider = useMemo(() => {
    if (!window.ethereum) return null;
    return new ethers.BrowserProvider(window.ethereum);
  }, []);

  function addLog(msg) {
    const ts = new Date().toLocaleTimeString();
    setLog((x) => [...x, `[${ts}] ${msg}`]);
  }

  // ERC-20 TGT ABI
  const tokenAbi = [
    "function decimals() view returns(uint8)",
    "function balanceOf(address) view returns(uint256)",
    "function allowance(address owner, address spender) view returns(uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
  ];

  // SimpleVault ABI (NO 'returns (void)' — just omit it)
  const vaultAbi = [
    "function token() view returns(address)",
    "function balanceOf(address) view returns(uint256)",
    "function deposit(uint256 amount)",
    "function withdraw(uint256 amount)",
  ];

  async function getToken(runner) {
    return new ethers.Contract(TGT_ADDR, tokenAbi, runner);
  }

  async function getVault(runner) {
    return new ethers.Contract(VAULT_ADDR, vaultAbi, runner);
  }

  async function refresh() {
    try {
      setBusy(true);
      setLog([]);
      if (!provider) throw new Error("No wallet (MetaMask) detected.");

      await window.ethereum.request({ method: "eth_requestAccounts" });
      const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });

      setNet({
        chainIdHex,
        name: chainIdHex === SEPOLIA_HEX ? "Sepolia" : `Chain ${chainIdHex}`,
      });
      if (chainIdHex !== SEPOLIA_HEX) {
        addLog("Note: You are not on Sepolia (0xaa36a7). Switch in MetaMask.");
      }

      // verify vault exists
      const code = await provider.getCode(VAULT_ADDR);
      if (!code || code === "0x") {
        addLog(`No contract code at VAULT ${VAULT_ADDR} on this network.`);
        return;
      }

      const read = provider;
      const vaultRead = await getVault(read);
      const tokenRead = await getToken(read);

      const d = await tokenRead.decimals().catch(() => 18);
      setDecimals(Number(d));

      const signer = await provider.getSigner();
      const me = await signer.getAddress();

      const [userTgt, vaultTgt, userShares, vToken] = await Promise.all([
        tokenRead.balanceOf(me),
        tokenRead.balanceOf(VAULT_ADDR),
        vaultRead.balanceOf(me),
        vaultRead.token(),
      ]);

      addLog("Vault.token() -> " + vToken);

      setBalances({ userTgt, vaultTgt, userShares });

      addLog(
        "Balances loaded. You: " +
          fmt(userTgt, d) +
          " TGT | Vault: " +
          fmt(vaultTgt, d) +
          " TGT | Your shares: " +
          fmt(userShares, d)
      );
    } catch (e) {
      addLog("Refresh error: " + (e.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function approveAndDeposit() {
    try {
      setBusy(true);
      if (!provider) throw new Error("No wallet detected.");
      const signer = await provider.getSigner();
      const me = await signer.getAddress();
      const token = await getToken(signer);
      const vault = await getVault(signer);

      const d = decimals || (await token.decimals().catch(() => 18));
      const amt = ethers.parseUnits(String(amount || "0"), d);
      if (amt <= 0n) throw new Error("Amount must be > 0");

      // Allowance
      const cur = await token.allowance(me, VAULT_ADDR);
      if (cur < amt) {
        addLog("Approving " + fmt(amt, d) + " TGT to VAULT…");
        const txA = await token.approve(VAULT_ADDR, amt);
        addLog("approve tx: " + txA.hash);
        await txA.wait();
        addLog("approve confirmed.");
      } else {
        addLog("Sufficient allowance already set.");
      }

      // Deposit
      addLog("Depositing " + fmt(amt, d) + " TGT…");
      const txD = await vault.deposit(amt);
      addLog("deposit tx: " + txD.hash);
      await txD.wait();
      addLog("deposit confirmed.");

      await refresh();
    } catch (e) {
      addLog("Deposit error: " + (e.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    try {
      setBusy(true);
      if (!provider) throw new Error("No wallet detected.");
      const signer = await provider.getSigner();
      const vault = await getVault(signer);

      const d = decimals || 18;
      const amt = ethers.parseUnits(String(amount || "0"), d);
      if (amt <= 0n) throw new Error("Amount must be > 0");

      addLog("Withdrawing " + fmt(amt, d) + " TGT…");
      const txW = await vault.withdraw(amt);
      addLog("withdraw tx: " + txW.hash);
      await txW.wait();
      addLog("withdraw confirmed.");

      await refresh();
    } catch (e) {
      addLog("Withdraw error: " + (e.message || String(e)));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chainBadge =
    net.chainIdHex === SEPOLIA_HEX ? (
      <span style={{ color: "#0a0", fontWeight: 600 }}>Sepolia</span>
    ) : net.chainIdHex ? (
      <span style={{ color: "#a60", fontWeight: 600 }}>
        {net.name} ({net.chainIdHex})
      </span>
    ) : (
      <span style={{ color: "#999" }}>Unknown</span>
    );

  return (
    <div style={{ marginTop: 16, padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
      <h2 style={{ margin: 0, marginBottom: 8 }}>Supplier Test (SimpleVault)</h2>

      <div style={{ marginBottom: 8 }}>
        <div><b>Network:</b> {chainBadge}</div>
        <div><b>VAULT:</b> {VAULT_ADDR}</div>
        <div><b>TGT:</b> {TGT_ADDR}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <div style={{ padding: 12, border: "1px solid #f0f0f0", borderRadius: 8 }}>
          <div style={{ color: "#666" }}>Your TGT</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {balances.userTgt !== null ? fmt(balances.userTgt, decimals) + " TGT" : "…"}
          </div>
        </div>
        <div style={{ padding: 12, border: "1px solid #f0f0f0", borderRadius: 8 }}>
          <div style={{ color: "#666" }}>Vault TGT</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {balances.vaultTgt !== null ? fmt(balances.vaultTgt, decimals) + " TGT" : "…"}
          </div>
        </div>
        <div style={{ padding: 12, border: "1px solid #f0f0f0", borderRadius: 8 }}>
          <div style={{ color: "#666" }}>Your Shares</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {balances.userShares !== null ? fmt(balances.userShares, decimals) : "…"}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontWeight: 600 }}>Amount (TGT):</label>
        <input
          type="number"
          min="0"
          step="0.000001"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", width: 180 }}
        />
        <button onClick={refresh} disabled={busy} style={{ padding: "8px 12px", borderRadius: 8 }}>
          Refresh
        </button>
        <button onClick={approveAndDeposit} disabled={busy} style={{ padding: "8px 12px", borderRadius: 8 }}>
          Approve + Deposit
        </button>
        <button onClick={withdraw} disabled={busy} style={{ padding: "8px 12px", borderRadius: 8 }}>
          Withdraw
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Log</div>
        <div
          style={{
            whiteSpace: "pre-wrap",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            border: "1px solid #f0f0f0",
            borderRadius: 8,
            padding: 8,
            maxHeight: 240,
            overflowY: "auto",
            background: "#fafafa",
            fontSize: 12
          }}
        >
          {log.length ? log.join("\n") : "No activity yet…"}
        </div>
      </div>
    </div>
  );
}
