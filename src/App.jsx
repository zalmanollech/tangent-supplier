// src/App.jsx
import React, { useState } from 'react'
import { useWallet } from './wallet'
import DocumentPanel from './DocumentPanel'

function Btn({ children, onClick, primary }) {
  const base = {
    display: 'inline-flex', gap: 8, alignItems: 'center',
    borderRadius: 16, padding: '10px 14px', border: '1px solid #ddd',
    background: primary ? '#111' : '#fff', color: primary ? '#fff' : '#111',
    cursor: 'pointer'
  }
  return <button style={base} onClick={onClick}>{children}</button>
}

function Step({ title, desc, done, onClick, actionLabel }) {
  return (
    <div style={{
      background:'#fff', border:'1px solid #e5e5e5', borderRadius:16, padding:16,
      display:'flex', gap:12, alignItems:'flex-start'
    }}>
      <div style={{
        marginTop:4, width:20, height:20, borderRadius:999,
        background: done ? '#22c55e' : '#d4d4d4'
      }}/>
      <div style={{flex:1}}>
        <div style={{fontWeight:600}}>{title}</div>
        <div style={{color:'#555', fontSize:14}}>{desc}</div>
      </div>
      <Btn onClick={onClick}>{actionLabel}</Btn>
    </div>
  )
}

function Supplier() {
  const [hasWallet, setHasWallet] = useState(false)
  const [docsUploaded, setDocsUploaded] = useState(false)
  const [depositPlaced, setDepositPlaced] = useState(false)
  const [keyIssued, setKeyIssued] = useState(false)
  return (
    <div style={{display:'grid', gap:12}}>
      <Step title="Get a wallet" desc="Install MetaMask and back up your seed phrase."
            done={hasWallet} onClick={()=>setHasWallet(true)} actionLabel="Mark done" />
      <Step title="Upload contract & e-docs" desc="Upload sales contract & certified documents."
            done={docsUploaded} onClick={()=>setDocsUploaded(true)} actionLabel="Upload" />

      {/* Your on-chain Document Panel (from src/DocumentPanel.jsx) */}
      <DocumentPanel />

      <Step title="Request 70% advance" desc="Receive 70% advance after verification."
            done={depositPlaced} onClick={()=>setDepositPlaced(true)} actionLabel="Request" />
      <Step title="Receive trade key" desc="Share with Buyer to unlock docs upon 100% payment."
            done={keyIssued} onClick={()=>setKeyIssued(true)} actionLabel="Issue key" />
    </div>
  )
}

function Buyer() {
  const [verified, setVerified] = useState(false)
  const [paid, setPaid] = useState(false)
  const [docsReleased, setDocsReleased] = useState(false)
  return (
    <div style={{display:'grid', gap:12}}>
      <Step title="Verify trade key" desc="Enter Supplier key."
            done={verified} onClick={()=>setVerified(true)} actionLabel="Verify" />
      <Step title="Pay 100% invoice" desc="Release e-documents."
            done={paid} onClick={()=>setPaid(true)} actionLabel="Pay now" />
      <Step title="Access e-docs" desc="Download shipment docs."
            done={docsReleased} onClick={()=>setDocsReleased(true)} actionLabel="Download" />
    </div>
  )
}

function Trader() {
  const [contracts, setContracts] = useState(false)
  const [deposit, setDeposit] = useState(false)
  const [linked, setLinked] = useState(false)
  return (
    <div style={{display:'grid', gap:12}}>
      <Step title="Upload two contracts" desc="Buyer↔Trader and Trader↔Supplier."
            done={contracts} onClick={()=>setContracts(true)} actionLabel="Upload" />
      <Step title="Place 30% deposit" desc="Trader deposit; Supplier paid on doc upload."
            done={deposit} onClick={()=>setDeposit(true)} actionLabel="Deposit" />
      <Step title="Link flows & verify" desc="Auto-link docs across both contracts."
            done={linked} onClick={()=>setLinked(true)} actionLabel="Link" />
    </div>
  )
}

export default function App(){
  const { hasProvider, account, shortAccount, isSepolia, error, connect, networkName } = useWallet()
  const [role, setRole] = useState('Supplier')
  const [authOpen, setAuthOpen] = useState(false)
  const [user, setUser] = useState(null)

  return (
    <div style={{fontFamily:'system-ui, Arial', background:'#f6f6f6', minHeight:'100vh'}}>
      {/* Header */}
      <div style={{position:'sticky', top:0, background:'#fff', borderBottom:'1px solid #e5e5e5'}}>
        <div style={{maxWidth:1080, margin:'0 auto', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <div style={{width:32,height:32,borderRadius:8,background:'#111',color:'#fff',display:'grid',placeItems:'center'}}>T</div>
            <strong>TANGENT</strong>
            <span className="badge">{user ? 'Signed in' : 'Guest'}</span>
          </div>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            {!hasProvider ? (
              <Btn onClick={()=> window.open('https://metamask.io/download/', '_blank')}>Get MetaMask</Btn>
            ) : (
              account ? (
                <span style={{display:'inline-flex',gap:8,alignItems:'center'}}>
                  <span style={{width:8,height:8,borderRadius:999, background: isSepolia ? '#16a34a' : '#f59e0b'}} />
                  <span>{shortAccount} {isSepolia ? '' : `(switch to ${networkName})`}</span>
                  {!isSepolia && <Btn onClick={connect}>Switch</Btn>}
                </span>
              ) : (
                <Btn onClick={connect} primary>Connect Wallet</Btn>
              )
            )}
            {user ? (
              <Btn onClick={()=>setUser(null)}>Sign out</Btn>
            ) : (
              <Btn onClick={()=>setAuthOpen(true)} primary>Sign in</Btn>
            )}
          </div>
        </div>
      </div>

      {/* Landing (logged out) */}
      {!user && (
        <section style={{borderBottom:'1px solid #e5e5e5', background:'linear-gradient(#fff,#f9f9f9)'}}>
          <div style={{maxWidth:1080, margin:'0 auto', padding:'24px 16px', display:'grid', gap:16}}>
            <h1 style={{margin:0}}>Finance & settle commodity trades</h1>
            <p style={{marginTop:-4, color:'#555'}}>Suppliers, Buyers, Traders — keys, e-docs, and simple flows.</p>
            <div><Btn primary onClick={()=>setAuthOpen(true)}>Get started</Btn></div>
          </div>
        </section>
      )}

      {/* Dashboards (logged in) */}
      {user && (
        <section style={{maxWidth:1080, margin:'0 auto', padding:'24px 16px'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
            <div>
              <div style={{fontSize:12, color:'#666'}}>Signed in as</div>
              <div style={{fontWeight:600}}>{user.email}</div>
            </div>
            <div style={{display:'flex', gap:8}}>
              {['Supplier','Buyer','Trader'].map(r => (
                <Btn key={r} onClick={()=>setRole(r)} primary={role===r}>{r}</Btn>
              ))}
            </div>
          </div>
          {role==='Supplier' && <Supplier/>}
          {role==='Buyer' && <Buyer/>}
          {role==='Trader' && <Trader/>}
        </section>
      )}

      {/* Footer */}
      <div style={{background:'#fff', borderTop:'1px solid #e5e5e5'}}>
        <div style={{maxWidth:1080, margin:'0 auto', padding:'12px 16px', display:'flex', justifyContent:'space-between', color:'#666', fontSize:14}}>
          <div>© {new Date().getFullYear()} TANGENT • Test MVP</div>
          <div style={{display:'flex', gap:12}}>
            <button onClick={()=>alert('Docs placeholder')} className="link">Docs</button>
            <button onClick={()=>alert('Privacy placeholder')} className="link">Privacy</button>
            <button onClick={()=>alert('Terms placeholder')} className="link">Terms</button>
          </div>
        </div>
      </div>

      {/* Sign-in modal */}
      {authOpen && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',display:'grid',placeItems:'center'}}>
          <div style={{background:'#fff', border:'1px solid #e5e5e5', borderRadius:16, padding:16, width:360}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
              <strong>Sign in</strong>
              <Btn onClick={()=>setAuthOpen(false)}>Close</Btn>
            </div>
            <label style={{fontSize:12}}>Email</label>
            <input id="email" type="email"
                   style={{width:'100%',padding:10,border:'1px solid #ddd',borderRadius:12,marginBottom:8}}/>
            <label style={{fontSize:12}}>Password</label>
            <input id="pass" type="password"
                   style={{width:'100%',padding:10,border:'1px solid #ddd',borderRadius:12,marginBottom:12}}/>
            <div style={{display:'flex', gap:8}}>
              <Btn primary onClick={()=>{
                const email = document.getElementById('email').value || 'demo@user'
                setUser({ email })
                setAuthOpen(false)
              }}>Sign in</Btn>
              <Btn onClick={()=>{ alert('Account created (demo)'); const email = document.getElementById('email').value || 'demo@user'; setUser({email}); setAuthOpen(false) }}>Create account</Btn>
            </div>
            {error && <div style={{marginTop:8, color:'#b91c1c'}}>{error}</div>}
          </div>
        </div>
      )}
    </div>
  )
}



