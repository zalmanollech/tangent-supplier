import { BrowserProvider, Contract, parseUnits, formatUnits } from "ethers";

// ERC20 (signatures)
const tgtAbi = [
  "function approve(address spender, uint256 value) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function transferFrom(address from, address to, uint256 value) returns (bool)",
  "function decimals() view returns (uint8)"
];

// Vault (signatures)
const vaultAbi = [
  "function vaultBalance() view returns (uint256)",
  "function deposit(uint256 amount)",
  "function adminWithdrawTo(address user, uint256 amount)",
  "function admin() view returns (address)",
  "function deposits(address) view returns (uint256)",
  "function token() view returns (address)"
];

// Force addresses (env or hard-coded)
export const TGT_ADDR   = (process.env.REACT_APP_TGT_ADDRESS   || "0x06d6C1c578e6c9dd801c65821BBDF4eCb5be5325").trim();
export const VAULT_ADDR = (process.env.REACT_APP_VAULT_ADDRESS || "0xd21d5cCa5f3a7EB614436C5b7F4577AEb339cAbe").trim();

export async function getProvider() {
  if (!window.ethereum) throw new Error("MetaMask not found");
  return new BrowserProvider(window.ethereum);
}

export async function getSigner() {
  const provider = await getProvider();
  await provider.send("eth_requestAccounts", []);
  return provider.getSigner();
}

export async function getContracts() {
  const provider = await getProvider();
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const tgt = new Contract(TGT_ADDR, tgtAbi, signer);
  const vault = new Contract(VAULT_ADDR, vaultAbi, signer);

  console.log("Using TGT at:", TGT_ADDR);
  console.log("Using VAULT at:", VAULT_ADDR);

  return { tgt, vault, signer, provider };
}

// Byte conversions
export const toWei = (n) => parseUnits(String(n), 18);
export const fromWei = (v) => Number(formatUnits(v, 18));

// Verify there is contract code at address
export async function hasCode(provider, address, label) {
  const code = await provider.getCode(address);
  const len = (code || "0x").length;
  console.log(`Bytecode at ${label} (${address}) length:`, len);
  return code && code !== "0x";
}
