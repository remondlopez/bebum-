(function(){
  const CATALOG = [
    ['Doppel',12,8500,1000],['Mutzig',12,8500,1000],['Export',12,8500,1000],['Castel Beer',12,8500,1000],
    ['Castel Milk',12,8500,1000],['Beaufort Light',12,8500,1000],['Beaufort Lager',12,8500,1000],
    ['World Cola',6,4000,1000],['Sprite',6,4000,1000],['Isenbeck',12,9500,1000],['Booster Cola',12,8500,1000],
    ['Booster Gin',12,8500,1000],['Booster Mango',12,8500,1000],['Big Guinness',12,14000,1500],
    ['Big Smooth',12,14000,1500],['Small Smooth',15,13000,1000],['Small Guinness',24,17000,1000],
    ['Smirnoff Ice',24,17000,1000],['Malta Guinness',24,15000,1000],['Top Tonic',12,5000,1000],
    ['Chill',12,8500,1000],['Van Pur',24,17000,1000],['Bavaria',24,19000,1000],['Power Malta',24,17000,1000],
    ['Heineken',24,21000,1500],['Orangina',6,4500,1000],['D\'jino',6,4500,1000],['Vimto',6,4500,1000],
    ['Top',6,3000,1000],['Supper Mount',6,1450,500],['Reaktor',12,4300,500]
  ].map(d=>({name:d[0],per:d[1],buy:d[2],sell:d[3]}));
  const CATVER=4;

  const SEED={'Export':[27,5,27],'Mutzig':[16,6,73],'Castel Beer':[16,5,57],
    'Beaufort Light':[13,0,5],'Beaufort Lager':[9,0,0],'Doppel':[7,0,1],
    'Castel Milk':[0,3,34],'World Cola':[1,0,1],'Sprite':[5,0,5],'Isenbeck':[2,5,45],
    'Booster Gin':[5,0,0],'Big Guinness':[12,1,11],'Small Guinness':[64,0,24],
    'Small Smooth':[24,0,11],'Booster Mango':[25,0,2],'Bavaria':[21,0,18],"D'jino":[5,0,2],
    'Top':[9,0,0],'Supper Mount':[15,0,11],'Vimto':[14,0,8],'Orangina':[13,0,12],
    'Van Pur':[9,0,0],'Chill':[23,0,23],'Reaktor':[0,3,30]};
  const SEED_DATE='2026-08-22';

  /* ---------- plumbing ---------- */
  const $=s=>document.querySelector(s);
  const $$=s=>[].slice.call(document.querySelectorAll(s));
  function shout(msg){
    let b=document.getElementById('boom');
    if(!b){ b=document.createElement('div'); b.id='boom'; b.className='boom';
      b.onclick=()=>b.remove(); document.getElementById('app').appendChild(b); }
    b.textContent='Problem: '+msg+' (tap to dismiss)';
  }
  window.addEventListener('error',e=>shout((e.error&&e.error.message)||e.message||'unknown'));
  window.addEventListener('unhandledrejection',e=>
    shout('storage \u2014 '+((e.reason&&e.reason.message)||e.reason||'unknown')));

  const supabase=window.supabase.createClient(
    'https://mzyjdrlpkkuwydniwtdx.supabase.co',
    'sb_publishable_P7HpT7sub08obAZTKssYew_keRZQDIN'
  );
  const mem={}, pre=sh=>(sh?'s:':'p:'), localPrefix='bebum:';
  let cloudWarning=false;
  const local={
    get(k,sh){ try{ const raw=localStorage.getItem(localPrefix+pre(sh)+k); return raw===null?null:JSON.parse(raw); }catch(_){ return null; } },
    set(k,v,sh){ try{ localStorage.setItem(localPrefix+pre(sh)+k,JSON.stringify(v)); }catch(_){} }
  };
  function cloudFailed(e){
    if(cloudWarning) return;
    cloudWarning=true;
    console.warn('Supabase storage is unavailable.',e);
    shout('Supabase is unavailable. Changes are saved only on this device until it reconnects.');
  }
  const store={
    async get(k,sh){
      if(!sh) return local.get(k,false);
      try{
        if(k.indexOf('day:')===0){ const {data,error}=await supabase.from('daily_records').select('data').eq('trading_date',k.slice(4)).maybeSingle(); if(error) throw error; return data?data.data:null; }
        if(k==='catalog'||k==='catver'){
          const {data,error}=await supabase.from('app_catalog').select('data').eq('id',1).maybeSingle(); if(error) throw error;
          if(!data) return null;
          const saved=data.data;
          return k==='catalog'?(Array.isArray(saved)?saved:saved.catalog||null):(saved.catver||null);
        }
      }catch(e){ cloudFailed(e); }
      const m=mem[pre(sh)+k]; return m===undefined?local.get(k,true):m;
    },
    async set(k,v,sh){
      mem[pre(sh)+k]=v; local.set(k,v,!!sh);
      if(!sh||k.indexOf('day:')!==0) return;
      try{ const {error}=await supabase.from('daily_records').upsert({trading_date:k.slice(4),data:v,updated_at:new Date().toISOString()}); if(error) throw error; }
      catch(e){ cloudFailed(e); }
    },
    async setCatalog(catalog,catver){
      mem['s:catalog']=catalog; mem['s:catver']=catver; local.set('catalog',catalog,true); local.set('catver',catver,true);
      try{ const {error}=await supabase.from('app_catalog').upsert({id:1,data:{catalog,catver},updated_at:new Date().toISOString()}); if(error) throw error; }
      catch(e){ cloudFailed(e); }
    },
    async list(p,sh){
      if(sh&&p==='day:'){
        try{ const {data,error}=await supabase.from('daily_records').select('trading_date'); if(error) throw error; return data.map(r=>'day:'+r.trading_date); }
        catch(e){ cloudFailed(e); }
      }
      return Object.keys(mem).filter(k=>k.indexOf(pre(sh)+p)===0).map(k=>k.slice(2));
    }
  };
  const SHARED=true;

  document.addEventListener('focusin',e=>{
    const t=e.target;
    if(t&&t.classList&&t.classList.contains('numin')) setTimeout(()=>{try{t.select();}catch(_){}},0);
  });
  document.addEventListener('input',e=>{
    const t=e.target;
    if(!t||!t.classList||!t.classList.contains('numin')) return;
    const clean=t.value.replace(/[^0-9.\-]/g,'');
    if(clean!==t.value){ const p=t.selectionStart; t.value=clean; try{t.setSelectionRange(p-1,p-1);}catch(_){} }
  },true);

  const fmt=n=>{ n=Math.round(n||0); return n.toLocaleString('en-US'); };
  const num=v=>{ const n=parseFloat(String(v==null?'':v).replace(/[^0-9.\-]/g,'')); return isNaN(n)?0:n; };
  const crates=v=>Math.max(0,Math.floor(num(v)));
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  /* ---------- state ---------- */
  let catalog=CATALOG.map(d=>({...d}));
  let day=null, dateKey=SEED_DATE, prevClose={}, prevWh={}, filter='moving', term='';
  const ROLES={keeper:'Store Keeper',tender:'Bar Attendant',manager:'Manager'};
  const PERMISSIONS={
    keeper:{read:['store','count','cash','report','month'],write:['store','price']},
    tender:{read:['store','count','cash','report','month'],write:['count','cash']},
    manager:{read:['store','count','cash','report','month'],write:['store','count','cash','price']}
  };
  let me=null;

  const locked=()=>!!(day&&day.locked);
  const canRead=tab=>!!(me&&PERMISSIONS[me.role]&&PERMISSIONS[me.role].read.includes(tab));
  function can(f){
    if(!me||!PERMISSIONS[me.role]) return false;
    const area=f==='wh'?'store':f==='close'?'count':f;
    return PERMISSIONS[me.role].write.includes(area);
  }
  function whRow(n){
    day.wh=day.wh||{};
    if(!day.wh[n]) day.wh[n]={open:0,buy:0,close:0,oset:false,cset:false};
    return day.wh[n];
  }
  const moves=()=>(day.moves=day.moves||[]);
  // Pending issues are held out of the store; a decision replaces that provisional quantity.
  const issuedTo=n=>moves().filter(m=>m.n===n).reduce((a,m)=>a+(m.b?m.b.c:m.c),0);
  const gotFrom=n=>moves().filter(m=>m.n===n&&m.b).reduce((a,m)=>a+m.b.c,0);
  const pending=()=>moves().filter(m=>!m.b);
  function whVar(n){
    const w=(day.wh&&day.wh[n])||null;
    if(!w) return null;
    if(!w.cset) return null;                       // nothing to compare until it is counted
    return (w.open||0)+(w.buy||0)-issuedTo(n)-(w.close||0);
  }
  const stamp=t=>{ const d=new Date(t);
    return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})+' '+
           d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); };
  function note(what,from,to){
    if(!day||!me) return;
    day.log=day.log||[];
    day.log.unshift({t:Date.now(),r:me.role,n:me.name,w:what,a:String(from),b:String(to)});
    if(day.log.length>200) day.log.length=200;
  }

  const blank=()=>({rows:{},cash:{rec:0,dam:0,exp:0,expd:'',expenses:[],sho:0,deb:0,debd:''}});
  function row(n){ if(!day.rows[n]) day.rows[n]={open:0,crates:0,close:0,touched:false}; return day.rows[n]; }
  const drink=n=>catalog.find(d=>d.name===n);
  function calc(n){
    const r=row(n), d=drink(n);
    const supply=r.crates*d.per, total=r.open+supply, sold=total-r.close;
    const buyU=d.buy?d.buy/d.per:0;
    return {supply,total,sold,amount:sold*d.sell,cost:sold*buyU,profit:sold*(d.sell-buyU)};
  }
  const counted=n=>!!(day.rows[n]&&day.rows[n].touched);
  function totals(){
    let sales=0,cost=0,qty=0;
    catalog.forEach(d=>{ if(counted(d.name)){ const c=calc(d.name); sales+=c.amount; cost+=c.cost; qty+=c.sold; }});
    const expenses=day.cash.expenses||[];
    const expenseTotal=expenses.length?expenses.reduce((sum,item)=>sum+num(item.amount),0):num(day.cash.exp);
    const ded=num(day.cash.dam)+expenseTotal+num(day.cash.sho);
    return {sales,cost,qty,gp:sales-cost,np:sales-cost-ded,
      bal:sales+num(day.cash.rec)-ded-num(day.cash.deb)};
  }
  const marg=d=>d.buy?d.sell-d.buy/d.per:0;
  // archived brands stay in the catalogue so past days still add up; they just leave the working lists
  const live=()=>catalog.filter(d=>!d.off);

  // last night's closing count IS this morning's opening stock
  function carryForward(){
    Object.keys(prevClose).forEach(n=>{
      if(!drink(n)) return;
      const v=prevClose[n];
      const r=day.rows[n];
      if(!r){ if(v) day.rows[n]={open:v,crates:0,close:0,touched:false,carried:true}; return; }
      if(!r.oset && !r.touched && !r.crates && !r.close && r.open!==v){ r.open=v; r.carried=true; }
    });
  }

  /* ---------- count tab ---------- */
  const moving=d=>{ const r=day.rows[d.name]; return r&&(r.touched||r.open||r.crates||r.close); };
  function visible(){
    let l=live().filter(d=>filter==='all'||moving(d));
    if(term) l=l.filter(d=>d.name.toLowerCase().indexOf(term)>-1);
    return l;
  }
  function drawCards(){
    const host=$('#cards'), list=visible();
    if(!list.length){
      host.innerHTML='<p class="empty">'+(term?'No drink matches \u201c'+esc(term)+'\u201d.'
        :'Nothing recorded for this day yet.<br>Switch to <b>All 31</b> to start the count.'
          +(dateKey!==SEED_DATE?'<br><br><button class="seeeg" id="seeEg">See the 22 August example</button>':''))+'</p>';
      drawProg();
      return;
    }
    host.innerHTML=list.map(d=>{
      const r=row(d.name), c=calc(d.name);
      const done=!!r.touched;
      const gone=(done&&c.total>0)?Math.max(0,Math.min(100,c.sold/c.total*100)):0;
      const bad=done&&c.sold<0, carry=prevClose[d.name];
      const drift=(carry!==undefined&&carry!==r.open)
        ? 'Closed at '+fmt(carry)+' last night but opened at '+fmt(r.open)+'.':'';
      const whEdit=can('open')||can('crates');
      const fld=(f,lbl,v)=>can(f)
        ? '<label class="f"><span>'+lbl+'</span><input class="f-i numin" type="text" inputmode="numeric" data-f="'+f+'" value="'+(v||'')+'" placeholder="0"></label>'
        : '<label class="f"><span>'+lbl+'</span><input class="f-i" type="text" data-f="'+f+'" value="'+fmt(v)+'" disabled></label>';
      return '<article class="drink'+(r.touched?' is-done':'')+(bad?' is-bad':'')+'" data-n="'+esc(d.name)+'">'
        +'<div class="drink-h"><h3 class="drink-n">'+esc(d.name)+'</h3>'
        +'<span class="drink-s">'+d.per+' a crate &middot; '+fmt(d.sell)+'</span></div>'
        +'<div class="fill"><i style="width:'+gone+'%"></i></div>'
        +'<div class="wh">'+fld('open',r.carried?'Opening \u21b2':'Opening',r.open)
        +fld('crates','Received \u2713',r.crates)
        +'<span class="wh-sup">'+fmt(c.total)+' to account for</span></div>'
        +(r.carried?'<p class="carry">Opening carried from last night\u2019s closing count.</p>':'')
        +'<div class="tally"><span class="tally-l">Left on the shelf</span>'
        +'<div class="step">'
        +(can('close')?'<button class="step-b" data-step="-1" aria-label="One fewer">\u2212</button>':'')
        +'<input class="bignum numin'+(r.touched?' is-set':'')+'" type="text" inputmode="numeric" data-f="close" value="'
          +(r.close||'')+'" placeholder="0"'+(can('close')?'':' disabled')+'>'
        +(can('close')?'<button class="step-b" data-step="1" aria-label="One more">+</button>':'')
        +'</div></div>'
        +(bad?'<p class="drink-w">More sold than you had. Check the opening figure or the count.</p>':'')
        +(drift?'<p class="drink-w">'+drift+'</p>':'')
        +'<div class="drink-f">'+(done
            ?'<span class="sold"><b>'+fmt(c.sold)+'</b> sold</span><span class="amt">'+fmt(c.amount)+'</span>'
            :'<span class="sold sold--wait">Not counted yet</span><span class="amt amt--wait">\u2014</span>')
        +'</div></article>';
    }).join('');
    drawProg();
  }
  function drawProg(){
    const list=live().filter(d=>filter==='all'||moving(d));
    const done=list.filter(d=>day.rows[d.name]&&day.rows[d.name].touched).length;
    const pct=list.length?done/list.length*100:0;
    $('#progI').style.width=pct+'%';
    $('#progN').textContent=list.length?done+' / '+list.length:'';
    $('#progL').textContent=!list.length?'Nothing counted yet'
      :done===list.length?'Every drink counted':'Counted so far';
  }
  function refreshCard(card){
    const n=card.dataset.n, r=row(n), c=calc(n), done=!!r.touched;
    const gone=(done&&c.total>0)?Math.max(0,Math.min(100,c.sold/c.total*100)):0;
    card.querySelector('.fill i').style.width=gone+'%';
    card.querySelector('.wh-sup').textContent=fmt(c.total)+' to account for';
    card.querySelector('.drink-f').innerHTML=done
      ?'<span class="sold"><b>'+fmt(c.sold)+'</b> sold</span><span class="amt">'+fmt(c.amount)+'</span>'
      :'<span class="sold sold--wait">Not counted yet</span><span class="amt amt--wait">\u2014</span>';
    card.classList.toggle('is-bad',done&&c.sold<0);
    card.classList.toggle('is-done',!!r.touched);
    const b=card.querySelector('.bignum'); if(b) b.classList.toggle('is-set',!!r.touched);
  }

  /* ---------- warehouse ---------- */
  let wTerm='', wFilter='all';
  const whGet=n=>(day.wh&&day.wh[n])||{open:0,buy:0,close:0,oset:false,cset:false};
  const whActive=n=>{ const w=day.wh&&day.wh[n];
    return !!(w&&(w.open||w.buy||w.close||w.cset))||issuedTo(n)>0; };

  // what the stock on the two shelves is actually worth
  function capital(){
    let bought=0, boughtV=0, whC=0, whV=0, barB=0, barV=0, done=0, short=0;
    catalog.forEach(d=>{
      const n=d.name, w=(day.wh&&day.wh[n])||null, r=(day.rows&&day.rows[n])||null;
      const perCrate=d.buy||0, perUnit=d.per?perCrate/d.per:0;
      if(w){
        if(w.cset){ done++; if(whVar(n)!==0) short++; }
        bought+=w.buy||0; boughtV+=(w.buy||0)*perCrate;
        const held=w.cset?(w.close||0):((w.open||0)+(w.buy||0)-issuedTo(n));
        if(held>0){ whC+=held; whV+=held*perCrate; }
      }
      if(r){
        const onShelf=r.touched?(r.close||0):((r.open||0)+(r.crates||0)*d.per);
        if(onShelf>0){ barB+=onShelf; barV+=onShelf*perUnit; }
      }
    });
    return {bought,boughtV,whC,whV,barB,barV,done,short,total:whV};
  }
  function drawWhSum(){
    const c=capital();
    const stat=(l,v,cls)=>'<div class="stat'+(cls||'')+'"><span>'+l+'</span><b>'+fmt(v)+'</b></div>';
    $('#whSum').innerHTML='<div class="panel"><h2 class="panel-h">Capital in stock</h2>'
      +'<p class="panel-p">What the warehouse is holding right now, valued at your buying prices.</p>'
      +'<div class="stats">'
      +stat('Crates bought today',c.bought)+stat('Spent on stock',c.boughtV)
      +stat('Crates in the store',c.whC)+stat('Store value',c.whV)
      +'</div>'
      +'<p class="panel-p" style="margin:14px 0 0">'+c.done+' of '+live().length
      +' brands counted'+(c.short?' \u00b7 '+c.short+' not balancing':'')+'.</p>'
      +'<div class="big"><span class="big-l">Total tied up in the store</span>'
      +'<output class="big-n big-n--a">'+fmt(c.whV)+'</output></div></div>';
  }
  function refreshWh(card){
    const n=card.dataset.n, w=whGet(n), out=issuedTo(n), v=whVar(n);
    card.querySelector('.wh-out b').textContent=fmt(out);
    const tag=card.querySelector('.wh-v');
    tag.className='wh-v'+(v!==null&&v!==0?' is-short':'');
    if(v===null){ tag.style.color='var(--dim2)'; tag.textContent='not counted'; }
    else { tag.style.color=''; tag.textContent = v===0 ? 'balances'
      : fmt(Math.abs(v))+' crate'+(Math.abs(v)===1?'':'s')+(v>0?' short':' over'); }
    const val=card.querySelector('.wh-val');
    if(val){ const held=w.cset?(w.close||0):((w.open||0)+(w.buy||0)-out);
      val.textContent=fmt(held)+' crates held \u00b7 '+fmt(held*(drink(n).buy||0)); }
    card.classList.toggle('is-short',v!==null&&v!==0);
  }
  function drawStore(){
    if($('#whList').contains(document.activeElement)){ drawWhSum(); return; }
    let list=live().filter(d=>wFilter==='all'||whActive(d.name));
    if(wTerm) list=list.filter(d=>d.name.toLowerCase().indexOf(wTerm)>-1);
    const host=$('#whList'), on=can('wh');
    if(!list.length){
      host.innerHTML='<p class="empty">'+(wTerm?'No drink matches \u201c'+esc(wTerm)+'\u201d.'
        :'No warehouse movement recorded for this day.<br>Switch to <b>All 31</b> to open the ledger.')+'</p>';
      return;
    }
    host.innerHTML=list.map(d=>{
      const n=d.name, w=whGet(n), out=issuedTo(n), got=gotFrom(n), v=whVar(n);
      const mine=moves().filter(m=>m.n===n);
      const fld=(f,lbl,val)=>on
        ? '<label class="f"><span>'+lbl+'</span><input class="f-i numin" type="text" inputmode="numeric" data-w="'+f+'" value="'+(val||'')+'" placeholder="0"></label>'
        : '<label class="f"><span>'+lbl+'</span><input class="f-i" type="text" data-w="'+f+'" value="'+fmt(val)+'" disabled></label>';
      return '<article class="wh-c'+(v!==null&&v!==0?' is-short':'')+'" data-n="'+esc(n)+'">'
        +'<div class="wh-hd"><h3 class="wh-n">'+esc(n)+'</h3>'
        +(v===null?'<span class="wh-v" style="color:var(--dim2)">not counted</span>'
           :'<span class="wh-v'+(v!==0?' is-short':'')+'">'
             +(v===0?'balances':fmt(Math.abs(v))+' crate'+(Math.abs(v)===1?'':'s')+(v>0?' short':' over'))+'</span>')
        +'</div>'
        +'<p class="wh-val">'+fmt(w.cset?(w.close||0):((w.open||0)+(w.buy||0)-out))+' crates held \u00b7 '
          +fmt((w.cset?(w.close||0):((w.open||0)+(w.buy||0)-out))*(d.buy||0))+'</p>'
        +'<div class="wh-g">'+fld('open','Opening crates',w.open)+fld('buy','Bought in',w.buy)
        +'<div class="wh-out"><span>Issued to bar</span><b>'+fmt(out)+'</b></div>'
        +fld('close','Counted now',w.close)+'</div>'
        +(on?'<div class="issue"><input class="numin" type="text" inputmode="numeric" data-issue="'+esc(n)+'" placeholder="crates">'
             +'<button data-send="'+esc(n)+'">Issue to bar</button></div>':'')
        +(mine.length?'<div style="margin-top:11px">'+mine.map(m=>
          '<div class="mv"><b>'+fmt(m.c)+' crates</b> issued by '+esc(m.w.by)+' at '+stamp(m.w.at)
          +(m.b?(m.b.c===m.c?' \u00b7 <span class="mv-ok">received in full by '+esc(m.b.by)+'</span>'
                    :m.b.c===0?' \u00b7 <span class="mv-gap">rejected by '+esc(m.b.by)+' and returned to store</span>'
                    :' \u00b7 <span class="mv-gap">only '+fmt(m.b.c)+' received by '+esc(m.b.by)+'; '+fmt(m.c-m.b.c)+' returned to store</span>')
                 :' \u00b7 <span class="mv-gap">not yet confirmed by the bar</span>')+'</div>').join('')+'</div>':'')
        +'</article>';
    }).join('');
  }

  let deliveryNotice='';
  function drawDeliv(){
    const list=pending(), host=$('#deliv');
    const notice=deliveryNotice?'<div class="transfer-note"><b>Store updated</b><span>'+deliveryNotice+'</span></div>':'';
    if(!list.length){ host.innerHTML=notice; return; }
    const on=can('close')||(me&&me.role==='manager');
    host.innerHTML=notice+'<div class="panel panel--delivery"><div class="delivery-h"><div><h2 class="panel-h">Arriving from the store</h2>'
      +'<p class="panel-p">Check each delivery before it becomes bar stock.</p></div>'
      +'<span class="delivery-count">'+list.length+' pending</span></div>'
      +list.map(m=>'<div class="dlv" data-id="'+m.id+'"><div class="dlv-t"><b>'+esc(m.n)+'</b>'
        +'<em>'+fmt(m.c)+' crates issued by '+esc(m.w.by)+' at '+stamp(m.w.at)+'</em></div>'
        +'<div class="dlv-review"><span class="dlv-exp">Expected <b>'+fmt(m.c)+'</b></span>'
          +'<label class="dlv-q"><span>Received</span><input class="numin" type="text" inputmode="numeric" data-got value="'+m.c+'"'+(on?'':' disabled')+'></label></div>'
        +(on?'<div class="dlv-a"><button data-accept="'+m.id+'">Accept</button><button class="dlv-edit" data-edit="'+m.id+'">Edit</button><button class="dlv-reject" data-reject="'+m.id+'">Reject</button></div>':'')+'</div>').join('')
      +'</div>';
  }

  /* ---------- cash ---------- */
  const CASHMAP={'#c-rec':'rec','#c-dam':'dam','#c-sho':'sho','#c-deb':'deb'};
  function drawDebtors(){
    const host=$('#debtorRows'), list=day.cash.debtors&&day.cash.debtors.length
      ?day.cash.debtors:[day.cash.debd||''];
    host.innerHTML=list.map((name,i)=>'<input class="f-i f-i--t debtor-row" type="text" data-debtor="'+i+'" value="'+esc(name)+'" placeholder="Name">').join('');
  }
  function drawExpenses(){
    const host=$('#expenseRows');
    const list=day.cash.expenses&&day.cash.expenses.length
      ?day.cash.expenses:[{amount:day.cash.exp||'',for:day.cash.expd||''}];
    host.innerHTML=list.map((item,i)=>'<div class="expense-row">'
      +'<input class="f-i numin" type="text" inputmode="numeric" data-expense-amount="'+i+'" value="'+(item.amount||'')+'" placeholder="Amount">'
      +'<input class="f-i f-i--t" type="text" data-expense-for="'+i+'" value="'+esc(item.for||'')+'" placeholder="What for"></div>').join('');
  }
  function drawCash(){
    const t=totals();
    $('#cashSales').textContent=fmt(t.sales);
    $('#cashBal').textContent=fmt(t.bal);
    drawExpenses();
    drawDebtors();
    Object.keys(CASHMAP).forEach(sel=>{
      const el=$(sel); el.disabled=!can('cash');
      if(document.activeElement!==el) el.value=day.cash[CASHMAP[sel]]||'';
    });
  }

  /* ---------- report ---------- */
  function drawSummary(){
    const t=totals();
    $('#r-sales').textContent=fmt(t.sales); $('#r-cost').textContent=fmt(t.cost);
    $('#r-gp').textContent=fmt(t.gp);       $('#r-np').textContent=fmt(t.np);
    $('#r-qty').textContent=fmt(t.qty);     $('#r-bal').textContent=fmt(t.bal);

    const f=[];
    catalog.forEach(d=>{
      if(!day.rows[d.name]) return;
      const r=day.rows[d.name], c=calc(d.name);
      if(r.touched&&c.sold<0) f.push([d.name,'Sold '+fmt(c.sold)+'. The count is higher than what was available.']);
      const carry=prevClose[d.name];
      if(carry!==undefined&&carry!==r.open)
        f.push([d.name,'Opened at '+fmt(r.open)+' but last night closed at '+fmt(carry)+'. '
          +fmt(Math.abs(carry-r.open))+' unaccounted for.']);
    });
    catalog.forEach(d=>{
      if(!d.buy||!counted(d.name)||calc(d.name).sold<=0) return;
      const m=marg(d);
      if(m<0) f.push([d.name,'Sells at '+fmt(d.sell)+' but costs '+fmt(d.buy/d.per)
        +' a bottle. Losing '+fmt(-m)+' on each one \u2014 check the crate size.']);
      else if(m/d.sell>0.7) f.push([d.name,'Margin reads '+Math.round(m/d.sell*100)
        +'%, far above every other drink. The crate price or size looks wrong.']);
    });
    $('#flags').innerHTML=
      (locked()?'<div class="shut"><b>Closed</b><span>All three have signed. Authorized users can still edit their figures; changes are recorded below.</span></div>':'')
      +f.map(x=>'<div class="flag"><b>'+esc(x[0])+'</b><span>'+esc(x[1])+'</span></div>').join('');

    const rows=catalog.filter(d=>counted(d.name)&&calc(d.name).sold!==0);
    const t2=totals();
    $('#rlist').innerHTML=rows.length
      ? rows.map(d=>{ const c=calc(d.name);
          return '<div class="rrow"><span class="rrow-n">'+esc(d.name)+'</span>'
            +'<span class="rrow-q">'+fmt(c.sold)+' &times; '+fmt(d.sell)+'</span>'
            +'<span class="rrow-a">'+fmt(c.amount)+'</span></div>'; }).join('')
        +'<div class="rrow rrow--tot"><span class="rrow-n">Total</span>'
        +'<span class="rrow-q">'+fmt(t2.qty)+' bottles</span>'
        +'<span class="rrow-a">'+fmt(t2.sales)+'</span></div>'
      : '<p class="panel-p" style="margin:0">No sales recorded yet.</p>';
  }
  function drawSigns(){
    const sg=day.sign||{};
    $('#signs').innerHTML=Object.keys(ROLES).map(k=>{
      const s0=sg[k];
      return '<div class="sig"><div class="sig-w"><b>'+ROLES[k]+'</b><span>'
        +(s0?'Signed by '+esc(s0.n):'Not signed')+'</span></div>'
        +(s0?'<span class="sig-d">'+stamp(s0.at)+'</span>'
            :'<button class="sig-b" data-sign="'+k+'"'
              +((me&&(me.role===k||me.role==='manager')&&!locked())?'':' disabled')+'>Sign</button>')
        +'</div>';
    }).join('')+(locked()&&me&&me.role==='manager'
      ?'<button class="reopen" id="reopen">Reopen this day</button>':'');

    $('#log').innerHTML=(day.log&&day.log.length)
      ? day.log.slice(0,40).map(l=>'<div class="logi"><time>'+stamp(l.t)+'</time><span><b>'
          +esc(l.n)+'</b> ('+(ROLES[l.r]||l.r)+') set <b>'+esc(l.w)+'</b> from '
          +esc(l.a||'0')+' to '+esc(l.b||'0')+'</span></div>').join('')
      : '<p class="panel-p" style="margin:0">Nothing changed yet today.</p>';
  }
  async function brandUsed(n){
    const touched=D=>{
      if(!D) return false;
      const r=D.rows&&D.rows[n], w=D.wh&&D.wh[n];
      if((D.moves||[]).some(m=>m.n===n)) return true;
      if(r&&(r.open||r.crates||r.close||r.touched)) return true;
      if(w&&(w.open||w.buy||w.close||w.cset)) return true;
      return false;
    };
    let days=touched(day)?1:0;
    const keys=await store.list('day:',SHARED);
    for(const k of keys){
      if(k==='day:'+dateKey) continue;
      const D=await store.get(k,SHARED);
      if(touched(D)) days++;
    }
    return days;
  }

  let delArm=null, delT=null;
  async function tryDelete(btn){
    const i=+btn.dataset.del, d=catalog[i];
    if(!d) return;
    const msg=$('#pbody [data-msg="'+i+'"]');
    if(delArm!==i){
      delArm=i; btn.textContent='Delete for good?'; btn.classList.add('is-warn');
      if(msg){ msg.className='prow-msg'; msg.textContent='This removes '+d.name+' from the list entirely. Tap again to confirm.'; }
      clearTimeout(delT);
      delT=setTimeout(()=>{ delArm=null; drawPrices(); },5000);
      return;
    }
    clearTimeout(delT); delArm=null;
    btn.textContent='Checking\u2026';
    const days=await brandUsed(d.name);
    if(days){
      if(msg){ msg.className='prow-msg';
        msg.textContent=d.name+' has figures in '+days+' day'+(days===1?'':'s')+' of records. '
          +'Deleting it would change those totals, so archive it instead \u2014 it disappears from the working lists but the history still adds up.'; }
      btn.textContent='Delete'; btn.classList.remove('is-warn');
      return;
    }
    catalog.splice(i,1);
    if(day.rows) delete day.rows[d.name];
    if(day.wh) delete day.wh[d.name];
    note('the drinks list',d.name+' on the list',d.name+' deleted');
    save(); draw();
  }

  function drawNewBrand(){
    const host=$('#newBrand');
    if(!can('price')){ host.innerHTML=''; return; }
    if(host.contains(document.activeElement)) return;
    host.innerHTML='<div class="nb"><p class="nb-h">Add a brand</p>'
      +'<input class="nb-n" id="nbName" type="text" placeholder="Drink name" autocomplete="off">'
      +'<div class="nb-g">'
      +'<label class="f"><span>Per crate</span><input class="f-i numin" id="nbPer" type="text" inputmode="numeric" placeholder="12"></label>'
      +'<label class="f"><span>Buy /crate</span><input class="f-i numin" id="nbBuy" type="text" inputmode="numeric" placeholder="8500"></label>'
      +'<label class="f"><span>Sell /unit</span><input class="f-i numin" id="nbSell" type="text" inputmode="numeric" placeholder="1000"></label>'
      +'</div><button class="nb-b" id="nbAdd">Add to the list</button>'
      +'<p class="nb-m" id="nbMsg"></p></div>';
  }
  function addBrand(){
    const name=$('#nbName').value.trim();
    const per=num($('#nbPer').value), buy=num($('#nbBuy').value), sell=num($('#nbSell').value);
    const msg=$('#nbMsg');
    const fail=t=>{ msg.className='nb-m bad'; msg.textContent=t; };
    if(!name) return fail('Give the drink a name.');
    const clash=catalog.find(d=>d.name.toLowerCase()===name.toLowerCase());
    if(clash) return fail(clash.off
      ? '\u201c'+clash.name+'\u201d is already on the list but archived. Restore it below instead.'
      : '\u201c'+clash.name+'\u201d is already on the list.');
    if(per<=0) return fail('How many bottles come in a crate?');
    if(sell<=0) return fail('What does one bottle sell for?');
    catalog.push({name,per,buy:buy>0?buy:null,sell});
    note('the drinks list','',name+' added');
    msg.className='nb-m good';
    msg.textContent=name+' added'+(buy>0?'':' \u2014 set its buying price below so profit is right')+'.';
    ['#nbName','#nbPer','#nbBuy','#nbSell'].forEach(k=>$(k).value='');
    save(); drawCards(); drawStore(); drawWhSum(); drawSummary(); drawSigns(); drawPrices();
    $$('.seg').forEach(b=>{ if(b.dataset.filter==='all') b.textContent='All '+live().length; });
  }
  function drawPrices(){
    const host=$('#pbody');
    if(host.contains(document.activeElement)) return;
    const on=can('price');
    host.innerHTML=catalog.map((d,i)=>{
      const m=marg(d), odd=!!d.buy&&(m<0||m/d.sell>0.7);
      const mgr=me&&me.role==='manager';
      return '<div class="prow'+(d.off?' is-off':'')+'"><div class="prow-h"><span class="prow-n">'+esc(d.name)
        +(d.off?' \u00b7 archived':'')+'</span>'
        +'<span class="prow-m'+(odd?' is-odd':'')+'">'+(d.buy?fmt(m)+' a bottle':'no buy price')+'</span>'
        +(mgr?'<button class="prow-x" data-off="'+i+'">'+(d.off?'Restore':'Archive')+'</button>':'')
        +(mgr?'<button class="prow-x" data-del="'+i+'">Delete</button>':'')
        +'</div>'
        +'<p class="prow-msg" data-msg="'+i+'"></p>'
        +'<div class="prow-g">'
        +'<label class="f"><span>Per crate</span><input class="f-i numin" type="text" inputmode="numeric" data-p="per" data-i="'+i+'" value="'+(d.per||'')+'"'+(on?'':' disabled')+'></label>'
        +'<label class="f"><span>Buy /crate</span><input class="f-i numin'+(d.buy?'':' is-blank')+'" type="text" inputmode="numeric" data-p="buy" data-i="'+i+'" value="'+(d.buy||'')+'" placeholder="?"'+(on?'':' disabled')+'></label>'
        +'<label class="f"><span>Sell /unit</span><input class="f-i numin" type="text" inputmode="numeric" data-p="sell" data-i="'+i+'" value="'+(d.sell||'')+'"'+(on?'':' disabled')+'></label>'
        +'</div></div>';
    }).join('');
  }
  let last=0;
  function drawTill(){
    const t=totals(), el=$('#till');
    el.textContent=fmt(t.sales);
    $('#tillSub').textContent=fmt(t.qty)+' bottle'+(Math.round(t.qty)===1?'':'s');
    if(t.sales!==last){ el.classList.add('is-tick'); setTimeout(()=>el.classList.remove('is-tick'),140); last=t.sales; }
  }
  function drawMe(){
    $('#meChip').textContent=me?(me.name+' \u00b7 '+ROLES[me.role]+' \u00b7 change'):'Who are you?';
  }
  function draw(){ drawCards(); drawDeliv(); drawStore(); drawWhSum(); drawCash(); drawSummary();
    drawSigns(); drawNewBrand(); drawPrices(); drawTill(); drawMe();
    $$('.seg').forEach(b=>{ if(b.dataset.filter==='all') b.textContent='All '+live().length; });
    $$('.wseg').forEach(b=>{ if(b.dataset.wfilter==='all') b.textContent='All '+live().length; }); }

  /* ---------- period reports ---------- */
  let mKey=SEED_DATE.slice(0,7), wKey=SEED_DATE, reportPeriod='month', mCache={};
  const MON=['January','February','March','April','May','June','July','August',
             'September','October','November','December'];

  // same arithmetic as the day view, but against a stored record rather than the open one
  function recTotals(D){
    let sales=0,cost=0,qty=0;
    catalog.forEach(d=>{
      const r=D&&D.rows&&D.rows[d.name];
      if(!r||!r.touched) return;
      const sold=(r.open||0)+(r.crates||0)*d.per-(r.close||0);
      sales+=sold*d.sell; cost+=sold*(d.buy?d.buy/d.per:0); qty+=sold;
    });
    let spent=0, crates=0;
    catalog.forEach(d=>{ const w=D&&D.wh&&D.wh[d.name];
      if(w&&w.buy){ crates+=w.buy; spent+=w.buy*(d.buy||0); } });
    const c=(D&&D.cash)||{};
    const expenses=c.expenses||[];
    const expenseTotal=expenses.length?expenses.reduce((sum,item)=>sum+num(item.amount),0):num(c.exp);
    const ded=num(c.dam)+expenseTotal+num(c.sho);
    return {sales,cost,qty,spent,crates,gp:sales-cost,np:sales-cost-ded,ded,
      bal:sales+num(c.rec)-ded-num(c.deb),debt:num(c.deb),
      dam:num(c.dam),exp:expenseTotal,sho:num(c.sho),rec:num(c.rec)};
  }
  function recDrink(D,d){
    const r=D&&D.rows&&D.rows[d.name];
    if(!r||!r.touched) return null;
    const sold=(r.open||0)+(r.crates||0)*d.per-(r.close||0);
    return {sold,sales:sold*d.sell,profit:sold*(d.sell-(d.buy?d.buy/d.per:0))};
  }
  const shiftMonth=(k,n)=>{ let [y,m]=k.split('-').map(Number); m+=n;
    y+=Math.floor((m-1)/12); m=((m-1)%12+12)%12+1;
    return y+'-'+String(m).padStart(2,'0'); };
  const keyDate=k=>{ const [y,m,d]=k.split('-').map(Number); return new Date(y,m-1,d); };
  const dateKeyOf=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  function weekStart(k){ const d=keyDate(k); d.setDate(d.getDate()-(d.getDay()+6)%7); return dateKeyOf(d); }
  const shiftWeek=(k,n)=>{ const d=keyDate(k); d.setDate(d.getDate()+n*7); return dateKeyOf(d); };
  function weekNumber(k){
    const d=keyDate(k); d.setDate(d.getDate()+3);
    const firstThursday=new Date(d.getFullYear(),0,4);
    firstThursday.setDate(firstThursday.getDate()+3-(firstThursday.getDay()+6)%7);
    return 1+Math.round((d-firstThursday)/604800000);
  }
  const shortDate=k=>keyDate(k).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
  async function loadPeriod(){ return reportPeriod==='week'?loadWeek():loadMonth(); }

  async function loadMonth(){
    const [y,m]=mKey.split('-').map(Number);
    $('#mLabel').textContent=MON[m-1]+' '+y;
    $('#mBody').innerHTML='<p class="empty">Loading the month\u2026</p>';
    const keys=(await store.list('day:',SHARED)).filter(k=>k.indexOf('day:'+mKey)===0);
    const recs={};
    for(const k of keys){
      const dk=k.slice(4);
      if(!mCache[dk]) mCache[dk]=await store.get(k,SHARED);
      if(mCache[dk]) recs[dk]=mCache[dk];
    }
    drawMonth(recs,y,m);
  }
  async function loadWeek(){
    const dates=Array.from({length:7},(_,i)=>{ const d=keyDate(wKey); d.setDate(d.getDate()+i); return dateKeyOf(d); });
    const end=dates[6], year=keyDate(wKey).getFullYear();
    $('#mLabel').textContent='Week '+weekNumber(wKey)+' · '+shortDate(wKey)+'–'+shortDate(end)+' '+year;
    $('#mBody').innerHTML='<p class="empty">Loading the week\u2026</p>';
    const recs={};
    for(const dk of dates){ if(!mCache[dk]) mCache[dk]=await store.get('day:'+dk,SHARED); if(mCache[dk]) recs[dk]=mCache[dk]; }
    drawWeek(recs,dates);
  }
  function drawWeek(recs,dates){
    const agg={sales:0,cost:0,gp:0,np:0,qty:0,ded:0,bal:0,debt:0,spent:0,crates:0};
    let traded=0;
    const daily=dates.map(dk=>{ const t=recs[dk]?recTotals(recs[dk]):null;
      if(t){ ['spent','crates'].forEach(k=>agg[k]+=t[k]); }
      if(t&&t.qty){ traded++; ['sales','cost','gp','np','qty','ded','bal','debt'].forEach(k=>agg[k]+=t[k]); }
      return {dk,t}; });
    if(!traded){ $('#mBody').innerHTML='<p class="empty">No days counted in this calendar week yet.</p>'; return; }
    const drinks=catalog.map(d=>{ let sold=0,sales=0,profit=0;
      Object.keys(recs).forEach(k=>{ const r=recDrink(recs[k],d); if(r){ sold+=r.sold; sales+=r.sales; profit+=r.profit; } });
      return {name:d.name,sold,sales,profit};
    }).filter(x=>x.sales!==0).sort((a,b)=>b.profit-a.profit);
    const stat=(l,v,cls)=>'<div class="stat'+(cls||'')+'"><span>'+l+'</span><b>'+fmt(v)+'</b></div>';
    $('#mBody').innerHTML='<div class="panel"><h2 class="panel-h">This calendar week</h2><div class="stats">'
      +stat('Revenue',agg.sales)+stat('Cost of drinks',agg.cost)+stat('Gross profit',agg.gp,' stat--good')
      +stat('Deductions',agg.ded)+stat('Net profit',agg.np,' stat--good')+stat('Bottles sold',agg.qty)
      +'</div><div class="big"><span class="big-l">Days counted</span><output class="big-n">'+traded+'</output></div></div>'
      +'<div class="panel"><h2 class="panel-h">Daily sales</h2>'+daily.map(x=>{ const label=keyDate(x.dk).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}), sales=x.t?x.t.sales:0;
        return '<button class="period-day" data-d="'+x.dk+'"><span>'+label+'</span><b>'+fmt(sales)+'</b></button>'; }).join('')+'</div>'
      +'<div class="panel"><h2 class="panel-h">What earned the money</h2>'+drinks.map(x=>'<div class="rrow"><span class="rrow-n">'+esc(x.name)+'</span><span class="rrow-q">'+fmt(x.sold)+' sold · '+fmt(x.sales)+'</span><span class="rrow-a">'+fmt(x.profit)+'</span></div>').join('')
      +'<div class="rrow rrow--tot"><span class="rrow-n">Gross profit</span><span class="rrow-q">'+fmt(agg.qty)+' bottles</span><span class="rrow-a">'+fmt(agg.gp)+'</span></div></div>'
      +'<div class="panel"><h2 class="panel-h">Cash</h2><div class="rrow"><span class="rrow-n">Banked</span><span class="rrow-a">'+fmt(agg.bal)+'</span></div><div class="rrow"><span class="rrow-n">Still owed to you</span><span class="rrow-a">'+fmt(agg.debt)+'</span></div><div class="rrow"><span class="rrow-n">Spent on stock</span><span class="rrow-q">'+fmt(agg.crates)+' crates</span><span class="rrow-a">'+fmt(agg.spent)+'</span></div></div>';
  }
  function drawMonth(recs,y,m){
    const days=new Date(y,m,0).getDate();
    const per=[], agg={sales:0,cost:0,gp:0,np:0,qty:0,ded:0,bal:0,debt:0,spent:0,crates:0};
    let traded=0, best=0;
    for(let i=1;i<=days;i++){
      const dk=y+'-'+String(m).padStart(2,'0')+'-'+String(i).padStart(2,'0');
      const t=recs[dk]?recTotals(recs[dk]):null;
      per.push({dk,i,t});
      if(t){ ['spent','crates'].forEach(k=>agg[k]+=t[k]); }
      if(t&&t.qty){ traded++; ['sales','cost','gp','np','qty','ded','bal','debt'].forEach(k=>agg[k]+=t[k]);
        if(t.sales>best) best=t.sales; }
    }
    if(!traded){
      $('#mBody').innerHTML='<p class="empty">No days counted in '+MON[m-1]+' yet.</p>';
      return;
    }
    const bars=per.map(p=>{
      const v=p.t?p.t.sales:0;
      const h=best?Math.max(2,v/best*100):2;
      return '<button class="chart-c'+(v?(v===best?' is-best':''):' is-none')+'" data-d="'+p.dk+'" '
        +'title="'+p.i+' \u2014 '+fmt(v)+'"><i style="height:'+h+'%"></i></button>';
    }).join('');

    const drinks=catalog.map(d=>{
      let sold=0,sales=0,profit=0;
      Object.keys(recs).forEach(k=>{ const r=recDrink(recs[k],d);
        if(r){ sold+=r.sold; sales+=r.sales; profit+=r.profit; } });
      return {name:d.name,sold,sales,profit};
    }).filter(x=>x.sales!==0).sort((a,b)=>b.profit-a.profit);

    const stat=(l,v,cls)=>'<div class="stat'+(cls||'')+'"><span>'+l+'</span><b>'+fmt(v)+'</b></div>';
    $('#mBody').innerHTML=
      '<div class="panel"><h2 class="panel-h">'+MON[m-1]+' so far</h2>'
      +'<div class="stats">'
      +stat('Revenue',agg.sales)+stat('Cost of drinks',agg.cost)
      +stat('Gross profit',agg.gp,' stat--good')+stat('Deductions',agg.ded)
      +stat('Net profit',agg.np,' stat--good')+stat('Bottles sold',agg.qty)
      +'</div>'
      +'<div class="big"><span class="big-l">Days counted</span><output class="big-n">'+traded+'</output></div>'
      +'</div>'
      +'<div class="panel"><h2 class="panel-h">Revenue by day</h2>'
      +'<div class="chart">'+bars+'</div>'
      +'<div class="chart-x"><span>1</span><span>'+days+'</span></div>'
      +'<p class="panel-p" style="margin:12px 0 0">Best day '+fmt(best)+' \u00b7 average '
        +fmt(agg.sales/traded)+' across '+traded+' day'+(traded===1?'':'s')+'. Tap a bar to open that day.</p>'
      +'</div>'
      +'<div class="panel"><h2 class="panel-h">What earned the money</h2>'
      +drinks.map(x=>'<div class="rrow"><span class="rrow-n">'+esc(x.name)+'</span>'
        +'<span class="rrow-q">'+fmt(x.sold)+' sold \u00b7 '+fmt(x.sales)+'</span>'
        +'<span class="rrow-a">'+fmt(x.profit)+'</span></div>').join('')
      +'<div class="rrow rrow--tot"><span class="rrow-n">Gross profit</span>'
      +'<span class="rrow-q">'+fmt(agg.qty)+' bottles</span>'
      +'<span class="rrow-a">'+fmt(agg.gp)+'</span></div></div>'
      +'<div class="panel"><h2 class="panel-h">Cash</h2>'
      +'<div class="rrow"><span class="rrow-n">Banked</span><span class="rrow-a">'+fmt(agg.bal)+'</span></div>'
      +'<div class="rrow"><span class="rrow-n">Still owed to you</span><span class="rrow-a">'+fmt(agg.debt)+'</span></div>'
      +'<div class="rrow"><span class="rrow-n">Spent on stock</span>'
      +'<span class="rrow-q">'+fmt(agg.crates)+' crates</span>'
      +'<span class="rrow-a">'+fmt(agg.spent)+'</span></div>'
      +'</div>'
      +'<p class="mfoot">Profit uses today\u2019s buying prices for every day of the month. '
      +'Change a crate price and past months move with it.</p>';
  }
  $$('.period-b').forEach(b=>b.addEventListener('click',()=>{
    reportPeriod=b.dataset.period;
    $$('.period-b').forEach(x=>{ const active=x===b; x.classList.toggle('is-on',active); x.setAttribute('aria-selected',String(active)); });
    mCache={}; loadPeriod();
  }));
  $('#mPrev').addEventListener('click',()=>{ if(reportPeriod==='week') wKey=shiftWeek(wKey,-1); else mKey=shiftMonth(mKey,-1); loadPeriod(); });
  $('#mNext').addEventListener('click',()=>{ if(reportPeriod==='week') wKey=shiftWeek(wKey,1); else mKey=shiftMonth(mKey,1); loadPeriod(); });
  $('#mBody').addEventListener('click',e=>{
    const b=e.target.closest('[data-d]'); if(!b) return;
    $('#date').value=b.dataset.d;
    term=''; $('#search').value='';
    loadDay(b.dataset.d);
    $$('.tab').find(t=>t.dataset.tab==='count').click();
  });

  /* ---------- persistence ---------- */
  let saveT=null;
  function save(){
    clearTimeout(saveT);
    saveT=setTimeout(()=>{
      mCache[dateKey]=day;
      store.set('day:'+dateKey,day,SHARED);
      store.setCatalog(catalog,CATVER);
    },350);
  }
  async function loadDay(key){
    dateKey=key;
    let d=await store.get('day:'+key,SHARED);
    if(!d&&key===SEED_DATE){
      d=blank();
      Object.keys(SEED).forEach(n=>{ const s=SEED[n];
        d.rows[n]={open:s[0],crates:s[1],close:s[2],touched:true}; });
      d.cash={rec:0,dam:0,exp:500,expd:'Photocopy',sho:0,deb:11000,debd:'Staff'};
    }
    day=d||blank();
    (day.moves||[]).forEach(m=>{ if(m.b) row(m.n).crates=gotFrom(m.n); });
    prevClose={}; prevWh={};
    const keys=(await store.list('day:',SHARED)).map(k=>k.slice(4)).filter(k=>k<key).sort();
    if(keys.length){
      const p=await store.get('day:'+keys[keys.length-1],SHARED);
      // a drink nobody counted yesterday keeps its stock rather than dropping to zero
      if(p&&p.rows) Object.keys(p.rows).forEach(n=>{
        const r=p.rows[n];
        prevClose[n]=r.touched?r.close:r.open;
      });
      if(p&&p.wh) Object.keys(p.wh).forEach(n=>{
        const w=p.wh[n];
        prevWh[n]=w.cset?w.close:w.open;
      });
    }
    carryForward();
    Object.keys(prevWh).forEach(n=>{
      if(!drink(n)||!prevWh[n]) return;
      const w=whRow(n);
      if(!w.oset&&!w.buy&&!w.cset&&!issuedTo(n)) w.open=prevWh[n];
    });
    draw();
    dayCaption();
  }

  /* ---------- events ---------- */
  $('#cards').addEventListener('input',e=>{
    const inp=e.target.closest('input[data-f]'); if(!inp) return;
    const card=inp.closest('.drink'), r=row(card.dataset.n);
    r[inp.dataset.f]=num(inp.value);
    if(inp.dataset.f==='close') r.touched=true;
    if(inp.dataset.f==='open'){ r.oset=true; r.carried=false; }
    refreshCard(card); drawProg(); drawTill(); drawCash(); save();
  });

  let stepFrom={}, stepT=null;
  $('#cards').addEventListener('click',e=>{
    const b=e.target.closest('[data-step]'); if(!b) return;
    const card=b.closest('.drink'), n=card.dataset.n, r=row(n);
    if(!(n in stepFrom)) stepFrom[n]=r.close;
    r.close=Math.max(0,num(r.close)+ +b.dataset.step);
    r.touched=true;
    const inp=card.querySelector('.bignum'); inp.value=r.close||'';
    refreshCard(card); drawProg(); drawTill(); drawCash();
    clearTimeout(stepT);
    stepT=setTimeout(()=>{
      Object.keys(stepFrom).forEach(k=>{
        if(stepFrom[k]!==day.rows[k].close) note(k+' closing count',stepFrom[k],day.rows[k].close);
      });
      stepFrom={}; drawSigns(); save();
    },1400);
    save();
  });

  // warehouse ledger edits
  $('#whList').addEventListener('input',e=>{
    const inp=e.target.closest('input[data-w]'); if(!inp) return;
    const n=inp.closest('.wh-c').dataset.n, w=whRow(n), f=inp.dataset.w;
    w[f]=crates(inp.value);
    if(f==='close') w.cset=inp.value.trim()!=='';
    if(f==='open') w.oset=true;
    refreshWh(inp.closest('.wh-c')); drawWhSum(); save();
  });

  // the store issues stock; the bar has to confirm it separately
  $('#whList').addEventListener('click',e=>{
    const b=e.target.closest('[data-send]'); if(!b) return;
    const n=b.dataset.send, card=b.closest('.wh-c');
    const box=card.querySelector('[data-issue]'), c=crates(box.value);
    if(c<=0){ box.focus(); return; }
    moves().push({id:'m'+Date.now()+Math.floor(Math.random()*1000),n:n,c:c,
      w:{by:me.name,at:Date.now()},b:null});
    note(n+' issued to the bar','',c+' crates');
    box.value='';
    drawStore(); drawWhSum(); drawDeliv(); drawSigns(); save();
  });

  // A decision finalizes the transfer; any unreceived crates return to the store balance.
  $('#deliv').addEventListener('click',e=>{
    const b=e.target.closest('[data-accept],[data-edit],[data-reject]'); if(!b) return;
    const wrap=b.closest('.dlv'), id=b.dataset.accept||b.dataset.edit||b.dataset.reject;
    const m=moves().find(x=>x.id===id);
    if(!m) return;
    const action=b.dataset.reject?'rejected':b.dataset.edit?'edited':'accepted';
    const got=action==='rejected' ? 0 : action==='accepted' ? m.c
      : Math.min(m.c,crates(wrap.querySelector('[data-got]').value));
    m.b={by:me.name,at:Date.now(),c:got};
    const r=row(m.n);
    r.crates=gotFrom(m.n);
    note(m.n+' delivery '+action,m.c+' crates issued',got+' crates received');
    const returned=m.c-got;
    deliveryNotice=esc(m.n)+': '+fmt(got)+' crate'+(got===1?'':'s')+' accepted by the bar'
      +(returned?', '+fmt(returned)+' returned to Store.':'.');
    drawCards(); drawDeliv(); drawStore(); drawWhSum(); drawSigns(); drawTill(); save();
  });

  $('#wSearch').addEventListener('input',e=>{ wTerm=e.target.value.trim().toLowerCase(); drawStore(); });
  $$('.wseg').forEach(b=>b.addEventListener('click',()=>{
    $$('.wseg').forEach(x=>x.classList.toggle('is-on',x===b));
    wFilter=b.dataset.wfilter; drawStore(); drawWhSum();
  }));

  $('#pane-cash').addEventListener('input',e=>{
    const amount=e.target.closest('[data-expense-amount]');
    const description=e.target.closest('[data-expense-for]');
    if(amount||description){
      const field=amount||description, i=+(amount?field.dataset.expenseAmount:field.dataset.expenseFor);
      day.cash.expenses=day.cash.expenses||[];
      day.cash.expenses[i]=day.cash.expenses[i]||{amount:0,for:''};
      if(amount) day.cash.expenses[i].amount=num(field.value); else day.cash.expenses[i].for=field.value;
      day.cash.exp=num(day.cash.expenses.reduce((sum,item)=>sum+num(item.amount),0));
      day.cash.expd=day.cash.expenses[0].for||'';
      $('#cashBal').textContent=fmt(totals().bal); save(); return;
    }
    const debtor=e.target.closest('[data-debtor]');
    if(debtor){
      day.cash.debtors=day.cash.debtors||[];
      day.cash.debtors[+debtor.dataset.debtor]=debtor.value;
      day.cash.debd=day.cash.debtors[0]||'';
      save(); return;
    }
    const k=CASHMAP['#'+e.target.id]; if(!k) return;
    day.cash[k]=(k==='expd'||k==='debd')?e.target.value:num(e.target.value);
    $('#cashBal').textContent=fmt(totals().bal); save();
  });
  $('#pane-cash').addEventListener('click',e=>{
    if(e.target.id==='addExpense'){
      day.cash.expenses=day.cash.expenses||[{amount:day.cash.exp||'',for:day.cash.expd||''}];
      day.cash.expenses.push({amount:'',for:''}); drawCash(); save();
    }
    if(e.target.id==='addDebtor'){
      day.cash.debtors=day.cash.debtors||[day.cash.debd||''];
      day.cash.debtors.push(''); drawCash(); save();
    }
    const step=e.target.closest('[data-debt-step]');
    if(step){ day.cash.deb=Math.max(0,num(day.cash.deb)+num(step.dataset.debtStep)); drawCash(); save(); }
  });

  $('#newBrand').addEventListener('click',e=>{ if(e.target.id==='nbAdd') addBrand(); });
  $('#newBrand').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); addBrand(); } });
  $('#pbody').addEventListener('click',e=>{
    const del=e.target.closest('[data-del]');
    if(del){ tryDelete(del); return; }
    const b=e.target.closest('[data-off]'); if(!b) return;
    delArm=null;
    const d=catalog[+b.dataset.off];
    d.off=!d.off;
    note('the drinks list',d.name+(d.off?' in use':' archived'),d.name+(d.off?' archived':' back in use'));
    save(); drawPrices(); drawCards(); drawStore(); drawWhSum(); drawSummary(); drawSigns();
    $$('.seg').forEach(x=>{ if(x.dataset.filter==='all') x.textContent='All '+live().length; });
  });
  $('#pbody').addEventListener('input',e=>{
    const inp=e.target.closest('input[data-p]'); if(!inp) return;
    const d=catalog[+inp.dataset.i], f=inp.dataset.p, raw=inp.value.trim();
    d[f]= raw===''?(f==='buy'?null:0):num(raw);
    inp.classList.toggle('is-blank',f==='buy'&&!d.buy);
    const m=marg(d), tag=inp.closest('.prow').querySelector('.prow-m');
    tag.textContent=d.buy?fmt(m)+' a bottle':'no buy price';
    tag.classList.toggle('is-odd',!!d.buy&&(m<0||m/d.sell>0.7));
    drawSummary(); drawTill(); save();
  });

  $$('.tab').forEach(b=>b.addEventListener('click',()=>{
    if(!canRead(b.dataset.tab)) return;
    $$('.tab').forEach(x=>{
      const active=x===b;
      x.classList.toggle('is-on',active);
      x.setAttribute('aria-selected',String(active));
    });
    ['store','count','cash','report','month'].forEach(p=>$('#pane-'+p).classList.toggle('is-hidden',p!==b.dataset.tab));
    if(b.dataset.tab==='month'){ mKey=dateKey.slice(0,7); wKey=weekStart(dateKey); mCache={}; loadPeriod(); }
    else if(b.dataset.tab!=='count') draw();
  }));
  $$('.seg').forEach(b=>b.addEventListener('click',()=>{
    $$('.seg').forEach(x=>x.classList.toggle('is-on',x===b));
    if(b.dataset.filter==='all') b.textContent='All '+live().length;
    filter=b.dataset.filter; drawCards();
  }));
  $('#cards').addEventListener('click',e=>{
    if(e.target.id==='seeEg'){ $('#date').value=SEED_DATE; loadDay(SEED_DATE); }
  });
  $('#theme').addEventListener('click',()=>{
    const app=document.getElementById('app');
    const night=app.classList.toggle('is-night');
    $('#theme').textContent=night?'Day':'Night';
    store.set('theme',night?'night':'day');
  });
  $('#search').addEventListener('input',e=>{ term=e.target.value.trim().toLowerCase(); drawCards(); });
  $('#date').addEventListener('change',e=>{
    if(!e.target.value) return;
    term=''; $('#search').value='';
    loadDay(e.target.value);
  });
  $('#wipe').addEventListener('click',()=>{
    day=blank(); save(); draw(); $$('.tab').find(t=>t.dataset.tab==='count').click();
  });

  function openGate(){
    $('#gate').classList.remove('is-hidden');
    $('#authSignout').classList.toggle('is-hidden',!me);
  }
  function setAuthenticatedUser(user){
    const role=user&&user.user_metadata&&user.user_metadata.role;
    if(!user||!ROLES[role]) return false;
    me={role,name:user.user_metadata.name||user.user_metadata.full_name||user.email};
    store.set('me',me);
    return true;
  }
  $('#authSubmit').addEventListener('click',async()=>{
    const email=$('#authEmail').value.trim(), password=$('#authPassword').value;
    const msg=$('#authMsg');
    if(!email||!password){ msg.textContent='Enter your email and password.'; return; }
    msg.textContent='Signing in...';
    const {data,error}=await supabase.auth.signInWithPassword({email,password});
    if(error){ msg.textContent=error.message; return; }
    if(!setAuthenticatedUser(data.user)){
      await supabase.auth.signOut();
      msg.textContent='Your account has no valid role. Ask the manager to assign one.';
      return;
    }
    $('#authPassword').value=''; $('#gate').classList.add('is-hidden'); draw();
  });
  $('#authPassword').addEventListener('keydown',e=>{ if(e.key==='Enter') $('#authSubmit').click(); });
  $('#authSignout').addEventListener('click',async()=>{ await supabase.auth.signOut(); });
  $('#meChip').addEventListener('click',openGate);
  $('#todayBtn').addEventListener('click',()=>{
    const t=iso(new Date());
    if(dateKey===t) return;
    $('#date').value=t; term=''; $('#search').value=''; loadDay(t);
  });

  $('#signs').addEventListener('click',e=>{
    const b=e.target.closest('[data-sign]');
    if(b){
      day.sign=day.sign||{};
      day.sign[b.dataset.sign]={n:me.name,at:Date.now()};
      note('signature of the '+ROLES[b.dataset.sign],'unsigned','signed');
      if(day.sign.keeper&&day.sign.tender&&day.sign.manager){ day.locked=true; note('the day','open','closed'); }
      save(); draw(); return;
    }
    if(e.target.id==='reopen'){
      day.locked=false; day.sign={};
      note('the day','closed','reopened');
      save(); draw();
    }
  });

  let busy=false;
  async function refresh(){
    if(busy) return;
    const a=document.activeElement;
    if(a&&a.tagName==='INPUT') return;
    busy=true; $('#refresh').classList.add('is-busy');
    try{
      const fresh=await store.get('day:'+dateKey,SHARED);
      if(fresh){ day=fresh; draw(); }
      const cat=await store.get('catalog',SHARED);
      if(cat&&cat.length){ catalog=cat; drawPrices(); }
    }catch(_){}
    busy=false; $('#refresh').classList.remove('is-busy');
  }
  $('#refresh').addEventListener('click',refresh);

  const wasVal=new WeakMap();
  document.addEventListener('focusin',e=>{ if(e.target.tagName==='INPUT') wasVal.set(e.target,e.target.value); },true);
  document.addEventListener('change',e=>{
    const t=e.target;
    if(t.tagName!=='INPUT'||t.id==='date'||t.id==='gName'||t.id==='search') return;
    const before=wasVal.get(t);
    if(before===undefined||before===t.value) return;
    let what='';
    const card=t.closest('.drink'), prow=t.closest('.prow'), cash=t.closest('#cashFields');
    if(card) what=card.dataset.n+' '+({open:'opening',crates:'crates in',close:'closing count'}[t.dataset.f]||'');
    else if(prow) what=prow.querySelector('.prow-n').textContent+' '
      +({per:'bottles per crate',buy:'buy price',sell:'sell price'}[t.dataset.p]||'');
    else if(cash){ const l=t.closest('label'); what=l?l.querySelector('span').textContent.toLowerCase():'cash'; }
    if(what){ note(what,before,t.value); save(); drawSigns(); }
  },true);

  const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const yesterday=()=>iso(new Date(Date.now()-86400000));

  function dayCaption(){
    const [y,m,dd]=dateKey.split('-').map(Number);
    const d=new Date(y,m-1,dd);
    const nice=d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
    const t=iso(new Date());
    $('#todayBtn').textContent = dateKey===t ? nice+' \u00b7 today'
      : dateKey===yesterday() ? nice+' \u00b7 yesterday \u00b7 back to today'
      : nice+' \u00b7 back to today';
  }

  (async function init(){
    const session=(await supabase.auth.getSession()).data.session;
    if(session&&!setAuthenticatedUser(session.user)) await supabase.auth.signOut();
    const ver=await store.get('catver',SHARED);
    const saved=await store.get('catalog',SHARED);
    if(ver===CATVER&&saved&&saved.length) catalog=saved;
    else await store.setCatalog(catalog,CATVER);

    const th=await store.get('theme');
    if(th==='night') document.getElementById('app').classList.add('is-night');
    $('#theme').textContent=th==='night'?'Day':'Night';

    // always open on today. The 22 August example is reachable from the empty state.
    const start=iso(new Date());
    $('#date').value=start;
    await loadDay(start);
    supabase.auth.onAuthStateChange((_event,session)=>{
      if(session&&setAuthenticatedUser(session.user)){ $('#gate').classList.add('is-hidden'); draw(); }
      else { me=null; store.set('me',null); openGate(); draw(); }
    });
    if(!me) openGate();
    setInterval(refresh,15000);
  })();
})();
