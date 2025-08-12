import React, { useMemo, useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js' // safe; guarded by env

// ---- Config (Demo Mode if either is blank) ----
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || ''

function useAuth() {
  const demoMode = !SUPABASE_URL || !SUPABASE_KEY
  const supabase = useMemo(
    () => (demoMode ? null : createClient(SUPABASE_URL, SUPABASE_KEY)),
    [demoMode]
  )
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (demoMode) return
    let unsub = () => {}
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      setUser(data?.user || null)
      const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
        setUser(session?.user || null)
      })
      unsub = () => sub.subscription.unsubscribe()
    })()
    return () => unsub()
  }, [demoMode, supabase])

  const signIn = async (email, password) => {
    setError(null); setLoading(true)
    try {
      if (demoMode) { await new Promise(r => setTimeout(r, 250)); setUser({ email, demo: true }); return }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (e) { setError(e.message || 'Sign-in failed') } finally { setLoading(false) }
  }
  const signUp = async (email, password) => {
    setError(null); setLoading(true)
    try {
      if (demoMode) { await new Promise(r => setTimeout(r, 250)); setUser({ email, demo: true }); return }
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
    } catch (e) { setError(e.message || 'Sign-up failed') } finally { setLoading(false) }
  }
  const signOut = async () => {
    setError(null); setLoading(true)
    try {
      if (demoMode) { setUser(null); return }
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
    } catch (e) { setError(e.message || 'Sign-out failed') } finally { setLoading(false) }
  }

  return { demoMode, user, loading, error, signIn, signUp, signOut }
}

function Btn({ children, onClick, primary }) {
  const cls = 'btn ' + (primary ? 'primary' : 'ghost')
  return <button className={cls} onClick={onClick}>{children}</button>
}

function Step({ title, desc, done, onClick, actionLabel }) {
  return (
    <div className="card" style={{display:'flex',gap:12,alignItems:'flex-start'}}>
      <div style={{marginTop:4,width:20,height:20,borderRadius:999,background: done?'#22c55e':'#d4d4d4'}} />
      <div style={{flex:1}}>
        <div style={{fontWeight:600}}>{title}</div>
        <div style={{color:'#555',fontSize:14}}>{desc}</div>
      </div>
      <Btn onClick={onClick}>{actionLabel}</Btn>
    </div>
  )
}

function Supplier() {
  const [a,b,c,d] = [useState(false),useState(false),useState(false),useState(false)]
  const [hasWallet,setHasWallet]=a,[docsUploaded,setDocsUploaded]=b,[depositPlaced,setDepositPlaced]=c,[keyIssued,setKeyIssued]=d
  return (
    <div className="grid" style={{gap:12}}>
      <Step title="Get a wallet" desc="Install MetaMask and back up your seed phrase." done={hasWallet} onClick={()=>setHasWallet(true)} actionLabel="Mark done" />
      <Step title="Upload contract & e-docs" desc="Upload Supplier–Buyer sales contract and certified docs." done={docsUploaded} onClick={()=>setDocsUploaded(true)} actionLabel="Upload" />
      <Step title="Request 70% advance" desc="Receive 70% advance after verification." done={depositPlaced} onClick={()=>setDepositPlaced(true)} actionLabel="Request" />
      <Step title="Receive trade key" desc="Share with Buyer to unlock docs upon 100% payment." done={keyIssued} onClick={()=>setKeyIssued(true)} actionLabel="Issue key" />
    </div>
  )
}
function Buyer() {
  const [verified,setVerified]=useState(false),[paid,setPaid]=useState(false),[docs,setDocs]=useState(false)
  return (
    <div className="grid" style={{gap:12}}>
      <Step title="Verify trade key" desc="Enter Supplier key." done={verified} onClick={()=>setVerified(true)} actionLabel="Verify" />
      <Step title="Pay 100% invoice" desc="Release e-documents." done={paid} onClick={()=>setPaid(true)} actionLabel="Pay now" />
      <Step title="Access e-docs" desc="Download shipment docs." done={docs} onClick={()=>setDocs(true)} actionLabel="Download" />
    </div>
  )
}
function Trader() {
  const [contracts,setContracts]=useState(false),[deposit,setDeposit]=useState(false),[linked,setLinked]=useState(false)
  return (
    <div className="grid" style={{gap:12}}>
      <Step title="Upload two contracts" desc="Buyer↔Trader and Trader↔Supplier." done={contracts} onClick={()=>setContracts(true)} actionLabel="Upload" />
      <Step title="Place 30% deposit" desc="Trader deposit; Supplier paid on doc upload." done={deposit} onClick={()=>setDeposit(true)} actionLabel="Deposit" />
      <Step title="Link flows & verify" desc="Auto-link docs across both contracts." done={linked} onClick={()=>setLinked(true)} actionLabel="Link" />
    </div>
  )
}

export default function FullApp() {
  const { demoMode, user, error, signIn, signUp, signOut } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)
  const [role, setRole] = useState('Supplier')

  return (
    <div>
      <header className="site">
        <div className="container" style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px'}}>
          <div className="row" style={{gap:8}}>
            <div style={{width:32,height:32,borderRadius:8,background:'#111',color:'#fff',display:'grid',placeItems:'center'}}>T</div>
            <strong>TANGENT</strong>
            <span className="badge">{demoMode ? 'Demo mode' : 'Supabase auth'}</span>
          </div>
          <div>
            {user
              ? <Btn onClick={signOut}>Sign out</Btn>
              : <Btn primary onClick={()=>setAuthOpen(true)}>Sign in</Btn>}
          </div>
        </div>
      </header>

      {!user && (
        <section style={{borderBottom:'1px solid #e5e5e5', background:'linear-gradient(#fff,#f9f9f9)'}}>
          <div className="container" style={{display:'grid',gap:24,padding:'24px 16px'}}>
            <h1 style={{fontSize:32,margin:0}}>Finance & settle commodity trades</h1>
            <p style={{color:'#555',marginTop:-8}}>Suppliers, Buyers, Traders — one place for keys, e-docs, and USD-backed rails.</p>
            <div className="row"><Btn primary onClick={()=>setAuthOpen(true)}>Get started</Btn></div>
          </div>
        </section>
      )}

      {user && (
        <section className="container" style={{padding:'24px 16px'}}>
          <div className="row" style={{justifyContent:'space-between'}}>
            <div>
              <div style={{fontSize:12,color:'#666'}}>Signed in as</div>
              <div style={{fontWeight:600}}>{user.email || 'demo@user'}</div>
            </div>
            <div className="row">
              {['Supplier','Buyer','Trader'].map(r => (
                <Btn key={r} onClick={()=>setRole(r)} primary={role===r}>{r}</Btn>
              ))}
            </div>
          </div>
          <div style={{marginTop:16}}>
            {role==='Supplier' && <Supplier/>}
            {role==='Buyer' && <Buyer/>}
            {role==='Trader' && <Trader/>}
          </div>
        </section>
      )}

      <footer className="site">
        <div className="container" style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',fontSize:14,color:'#666'}}>
          <div>© {new Date().getFullYear()} TANGENT • Test MVP</div>
          <div className="row" style={{gap:12}}>
            <a>Docs</a><a>Privacy</a><a>Terms</a>
          </div>
        </div>
      </footer>

      {authOpen && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',display:'grid',placeItems:'center'}}>
          <div className="card" style={{width:360}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <strong>Sign in</strong>
              <Btn onClick={()=>setAuthOpen(false)}>Close</Btn>
            </div>
            {error && <div style={{color:'#b91c1c', fontSize:14, marginBottom:8}}>{error}</div>}
            <label style={{fontSize:12}}>Email</label>
            <input id="email" type="email" style={{width:'100%',padding:10,border:'1px solid #ddd',borderRadius:12,marginBottom:8}} />
            <label style={{fontSize:12}}>Password</label>
            <input id="pass" type="password" style={{width:'100%',padding:10,border:'1px solid #ddd',borderRadius:12,marginBottom:12}} />
            <div className="row">
              <Btn primary onClick={()=>{
                const email = document.getElementById('email').value
                const pass = document.getElementById('pass').value
                signIn(email, pass)
              }}>Sign in</Btn>
              <Btn onClick={()=>{
                const email = document.getElementById('email').value
                const pass = document.getElementById('pass').value
                signUp(email, pass)
              }}>Create account</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
