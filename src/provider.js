// src/provider.js
import { ethers } from "ethers";

export function hasWallet() {
  return typeof window !== "undefined" && typeof window.ethereum !== "undefined";
}

export function getProvider() {
  if (!hasWallet()) return null;
  return new ethers.BrowserProvider(window.ethereum);
}

export async function ensureSepolia() {
  if (!hasWallet()) return false;
  try {
    const provider = getProvider();
    const net = await provider.getNetwork();
    if (Number(net.chainId) === 11155111) return true; // Sepolia
    // Try switch first
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xaa36a7" }], // Sepolia
    });
    return true;
  } catch (e) {
    // If chain not added, try add+switch
    if (e && e.code === 4902) {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0xaa36a7",
              chainName: "Sepolia",
              nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
              rpcUrls: [
                "https://sepolia.infura.io/v3/YOUR_KEY",
                "https://rpc.sepolia.org",
              ],
              blockExplorerUrls: ["https://sepolia.etherscan.io"],
            },
          ],
        });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}
