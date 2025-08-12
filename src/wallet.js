import { useEffect, useState } from 'react'

// Sepolia chain id
const SEPOLIA_CHAIN_ID_HEX = '0xaa36a7'
const NETWORK_NAME = process.env.REACT_APP_NETWORK || 'sepolia'
const RPC_URL = process.env.REACT_APP_RPC || 'https://sepolia.infura.io/v3/YOUR_KEY'

export function useWallet(){
  const hasProvider = typeof window !== 'undefined' && !!window.ethereum
  const [account, setAccount] = useState(null)
  const [chainId, setChainId] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!hasProvider) return
    window.ethereum.request({ method: 'eth_chainId' }).then(id => setChainId(id)).catch(()=>{})
    window.ethereum.request({ method: 'eth_accounts' }).then(accs => setAccount(accs?.[0] || null)).catch(()=>{})
    const onAccountsChanged = accs => setAccount(accs?.[0] || null)
    const onChainChanged = id => setChainId(id)
    window.ethereum.on('accountsChanged', onAccountsChanged)
    window.ethereum.on('chainChanged', onChainChanged)
    return () => {
      try {
        window.ethereum.removeListener('accountsChanged', onAccountsChanged)
        window.ethereum.removeListener('chainChanged', onChainChanged)
      } catch {}
    }
  }, [hasProvider])

  const isSepolia = (chainId || '').toLowerCase() === SEPOLIA_CHAIN_ID_HEX
  const shortAccount = account ? account.slice(0,6) + '…' + account.slice(-4) : null

  async function connect(){
    setError(null)
    if (!hasProvider) { setError('MetaMask not found'); return }
    try {
      const accs = await window.ethereum.request({ method: 'eth_requestAccounts' })
      setAccount(accs?.[0] || null)
      const id = await window.ethereum.request({ method: 'eth_chainId' })
      if ((id || '').toLowerCase() !== SEPOLIA_CHAIN_ID_HEX){
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
          })
        } catch (err){
          if (err && err.code === 4902){
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: SEPOLIA_CHAIN_ID_HEX,
                chainName: 'Sepolia',
                rpcUrls: [RPC_URL],
                nativeCurrency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
              }]
            })
          } else { throw err }
        }
      }
      const newId = await window.ethereum.request({ method: 'eth_chainId' })
      setChainId(newId)
    } catch (e){ setError(e?.message || String(e)) }
  }

  return { hasProvider, account, shortAccount, chainId, isSepolia, error, connect, networkName: NETWORK_NAME }
}
