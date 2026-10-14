(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const months = {januari:1,februari:2,maret:3,april:4,mei:5,juni:6,juli:7,agustus:8,september:9,oktober:10,november:11,desember:12};
  const zoneNames = {WIB:'Asia/Jakarta',NY:'America/New_York',UTC:'UTC',LONDON:'Europe/London',TOKYO:'Asia/Tokyo'};
  const countryCodes = 'USD|CNY|GBP|EUR|JPY|AUD|CAD|NZD|CHF';
  const timeRow = new RegExp('(?:^|\\s)([01]?\\d|2[0-3])[.:]([0-5]\\d)\\s*('+countryCodes+')\\b','i');
  let imageFiles = [];

  function screenshotDate(text, fallback) {
    const match = text.toLowerCase().match(/\b(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)(?:\s+(20\d{2}))?/);
    if (!match) return fallback;
    const month = String(months[match[2]]).padStart(2,'0'), day = match[1].padStart(2,'0');
    let year = Number(match[3] || fallback?.slice(0,4) || new Date().getFullYear());
    if (!match[3] && fallback) {
      const fMonth=Number(fallback.slice(5,7));
      if (fMonth===12 && Number(month)===1) year++;
      if (fMonth===1 && Number(month)===12) year--;
    }
    return `${year}-${month}-${day}`;
  }

  function toWib(date, clock, zone) {
    const [y,m,d]=date.split('-').map(Number),[h,minute]=clock.split(':').map(Number);
    if (!Number.isInteger(y)||!Number.isInteger(m)||!Number.isInteger(d)||!Number.isInteger(h)||!Number.isInteger(minute)||m<1||m>12||d<1||d>31||h>23||minute>59||!zoneNames[zone]) return '';
    const wanted=Date.UTC(y,m-1,d,h,minute);
    let instant=wanted;
    const fmt=new Intl.DateTimeFormat('en-US',{timeZone:zoneNames[zone],hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
    for(let i=0;i<4;i++){
      const parts=Object.fromEntries(fmt.formatToParts(new Date(instant)).map(part=>[part.type,Number(part.value)]));
      const shown=Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute);
      const delta=wanted-shown;
      if(!delta)break;
      instant+=delta;
    }
    return new Date(instant+7*3600000).toISOString().slice(0,16).replace('T',' ');
  }

  function classify(title, currency) {
    const t=title.toLowerCase();
    if(currency==='USD' && /\b(cpi|ihk)\b|consumer price/.test(t))return {key:'US_CPI',name:'Inflasi konsumen AS (CPI)',level:'very-high',why:'Kejutan inflasi dapat mengubah ekspektasi suku bunga AS; USD, yield, dan emas bisa bergerak tajam.',scenario:'Angka di atas perkiraan sering mendukung USD dan menekan emas; di bawah perkiraan sering sebaliknya. Reaksi awal tidak pasti.'};
    if(currency==='USD' && /nfp|non.?farm|employment situation|payroll/.test(t))return {key:'US_NFP',name:'Tenaga kerja AS (NFP)',level:'very-high',why:'Jumlah pekerjaan, pengangguran, dan upah dinilai bersama; hasil campuran bisa membalikkan gerakan pertama.',scenario:'Data tenaga kerja jauh lebih kuat dari perkiraan bisa mendukung USD; data lemah bisa menekan USD. Emas tidak selalu bergerak berlawanan.'};
    if(currency==='USD' && /ppi|ipp|producer price/.test(t))return {key:'US_PPI',name:'Harga produsen AS (PPI)',level:'high',why:'Kejutan harga produsen dapat mengubah perkiraan inflasi dan suku bunga AS.',scenario:'Perhatikan selisih aktual dengan perkiraan dan reaksi USD/yield sebelum menyimpulkan arah emas.'};
    if(currency==='USD' && /jolts|job openings/.test(t))return {key:'US_JOLTS',name:'Lowongan kerja AS (JOLTS)',level:'medium',why:'Menggambarkan kondisi pasar kerja AS.',scenario:'Dampak bergantung besarnya kejutan dan berita lain yang terbit bersamaan.'};
    if(currency==='USD' && /fomc|powell|federal reserve|\bfed\b|bowman|waller/.test(t))return {key:'US_FED',name:'Pidato / keputusan The Fed',level:/rate|suku bunga|decision|keputusan|powell|chair/i.test(t)?'very-high':'high',why:'Komentar baru tentang inflasi atau suku bunga bisa mengubah USD dan yield; topik regulasi bisa berdampak lebih kecil.',scenario:'Nada lebih ketat dapat mendukung USD dan menekan emas; nada lebih longgar dapat berdampak sebaliknya. Isi pidato perlu diketahui terlebih dahulu.'};
    if(currency==='USD' && /pce|personal consumption/.test(t))return {key:'US_PCE',name:'Inflasi PCE AS',level:'very-high',why:'Ukuran inflasi penting bagi pembahasan kebijakan The Fed.',scenario:'Kejutan terhadap perkiraan dapat mengubah USD dan emas, tanpa arah yang dijamin.'};
    if(currency==='USD' && /gdp|pdb/.test(t))return {key:'US_GDP',name:'PDB AS',level:'high',why:'Perubahan prospek pertumbuhan bisa memengaruhi USD dan suku bunga.',scenario:'Bandingkan aktual, perkiraan, serta revisi data sebelumnya.'};
    if(currency==='USD' && /retail sales|penjualan ritel|\bism\b|pmi/.test(t))return {key:'US_ACTIVITY',name:'Aktivitas ekonomi AS',level:'high',why:'Data permintaan/aktivitas yang mengejutkan dapat menggeser pandangan pasar terhadap ekonomi AS.',scenario:'Arah emas tidak bisa dipastikan sebelum melihat hasil dan respons pasar.'};
    if(/\biea\b|oil market|laporan bulanan iea/.test(t))return {key:'IEA',name:'Laporan IEA',level:'watch',why:'Terutama terkait minyak; dampak ke XAUUSD biasanya tidak langsung.',scenario:'Pantau minyak dan USD; laporan ini sendiri bukan sinyal entry emas.'};
    if(currency==='CNY')return {key:'CHINA',name:'Data ekonomi China',level:'watch',why:'Terutama memengaruhi CNY dan pandangan terhadap ekonomi China; hubungan dengan XAUUSD tidak langsung.',scenario:'Angka kuat/lemah tidak otomatis berarti buy/sell emas.'};
    if(/boe|bailey|\bmpc\b/.test(t))return {key:'BOE',name:'Pidato / keputusan Bank of England',level:'high',why:'Terutama memengaruhi GBP jika ada perubahan pandangan tentang suku bunga.',scenario:'Nada lebih ketat bisa mendukung GBP; tidak otomatis menentukan arah XAUUSD.'};
    if(/rate|suku bunga|central bank|bank sentral|\becb\b|\bboj\b/.test(t))return {key:currency+'_CENTRAL',name:'Bank sentral '+currency,level:'high',why:'Dapat menggerakkan mata uang terkait ketika kebijakan atau proyeksi berubah.',scenario:'Baca keputusan dan pernyataan lengkap; judul kalender saja tidak menentukan arah.'};
    return {key:'OTHER',name:'Berita ekonomi lain',level:'medium',why:'Dampak belum dapat ditentukan hanya dari judul OCR.',scenario:'Periksa sumber rilis dan reaksi pasar; jangan menganggap ini sinyal arah.'};
  }

  function screenshotNumbers(text) {
    const read=pattern=>text.match(pattern)?.[1]?.replace(/\s+/g,'')||'';
    const value='([+−-]?\\d+(?:[.,]\\d+)?\\s*(?:%|[BMK])?)';
    const actual=read(new RegExp('(?:Tindakan|Aktual|Actual)\\s*[:.]?\\s*'+value,'i'));
    const forecast=read(new RegExp('(?:Prak\\.?|Perkiraan|Forecast)\\s*[:.]?\\s*'+value,'i'));
    const previous=read(new RegExp('(?:Seb\\.?|Sebelumnya|Previous)\\s*[:.]?\\s*'+value,'i'));
    const number=x=>Number(x.replace('−','-').replace(',','.').replace(/[^\d.\-]/g,''));
    const comparison=actual&&forecast&&Number.isFinite(number(actual))&&Number.isFinite(number(forecast))&&actual.replace(/[\d.,+−-]/g,'')===forecast.replace(/[\d.,+−-]/g,'')?(number(actual)>number(forecast)?'di atas':number(actual)<number(forecast)?'di bawah':'sama dengan')+' perkiraan':'';
    return {actual,forecast,previous,comparison};
  }

  function displayScreenshotNumbers(row) {
    if(row.currency==='CNY' || row.level==='watch') return '';
    const values=[row.actual,row.forecast,row.previous].filter(Boolean);
    if(!values.length)return '';
    const suspicious=values.some(value=>{
      const n=Number(value.replace('−','-').replace(',','.').replace(/[^\d.\-]/g,''));
      return !Number.isFinite(n) || (value.includes('%') && Math.abs(n)>100) || ((row.key==='US_CPI'||row.key==='US_PPI') && value.includes('%') && Math.abs(n)>15);
    });
    if(suspicious)return '<br><b>Angka OCR diabaikan:</b> ada angka yang kemungkinan salah terbaca. Panduan waktu tetap memakai jadwal berita.';
    return `<br><b>Angka pada screenshot:</b> aktual ${safe(row.actual||'belum rilis')} · perkiraan ${safe(row.forecast||'—')} · sebelumnya ${safe(row.previous||'—')}${row.comparison?' · aktual '+safe(row.comparison):''}. Angka ini belum diverifikasi ke sumber data resmi.`;
  }

  function parseEvents(text, fallbackDate, zone) {
    const lines=text.replace(/\r/g,'').split('\n').map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
    const date=screenshotDate(text,fallbackDate), rows=[];
    for(const line of lines){
      const match=line.match(timeRow);
      if(match){
        const time=match[1].padStart(2,'0')+':'+match[2],currency=match[3].toUpperCase();
        rows.push({time,currency,lines:[line.slice(match.index+match[0].length).trim()]});
      }else if(rows.length && !/^(profit|deposit|balance|kalender ekonomi|hari ini|besok|kemarin|minggu ini)$/i.test(line)) rows.at(-1).lines.push(line);
    }
    return rows.map(row=>{
      const joined=row.lines.join(' ');
      const title=joined.split(/\b(?:tindakan|aktual|actual|prak\.?|forecast|sebelumnya|previous|seb\.?)\s*[:.]?/i)[0].replace(/[|•]+/g,' ').trim().slice(0,130);
      const kind=classify(title,row.currency);
      return {...row,title:title||kind.name,date,zone,shownTime:row.time,wib:toWib(date,row.time,zone),...kind,...screenshotNumbers(joined)};
    }).filter(row=>row.wib&&row.title&&row.title.length>=4);
  }

  function relevant(row,pair) {
    if(row.level==='watch')return false;
    if(row.currency==='USD')return pair.includes('USD')||pair.includes('XAU')||pair.includes('GOLD');
    return pair.includes(row.currency);
  }

  function readFeedEvent(feed,row) {
    if(!Array.isArray(feed.events))return null;
    return feed.events.find(x=>x.key===row.key&&x.dateWib===row.wib.slice(0,10))||null;
  }

  function recommendation(events,pair,planned,before,after,feedInfo) {
    const view=$('newsImageResult');
    if(!events.length){view.innerHTML='<div class="result-box"><strong>Jadwal tidak terbaca dengan cukup jelas.</strong><p>Web tidak membuat rekomendasi waktu dari OCR yang kosong. Coba screenshot asli dengan teks kalender terlihat penuh.</p></div>';return}
    const plannedMs=planned?Date.parse(planned.replace(' ','T')+'Z'):NaN;
    let blocked=[];
    const cards=events.map(row=>{
      const rel=relevant(row,pair),verified=!!row.official,level=row.level;
      const b=level==='very-high'||level==='high'?before:Math.min(before,30);
      const a=level==='very-high'||level==='high'?after:Math.min(after,60);
      const start=Date.parse(row.wib.replace(' ','T')+'Z');
      if(rel&&level!=='watch'&&Number.isFinite(start))blocked.push({start:start-b*60000,end:start+a*60000,row});
      const fmt=ms=>new Date(ms).toISOString().slice(0,16).replace('T',' ');
      const windowText=rel&&level!=='watch'?`Hindari entry ${fmt(start-b*60000)}–${fmt(start+a*60000)} WIB.`:`Untuk ${pair}, tidak ada larangan otomatis dari berita ini.`;
      const source=verified?`<a href="${safe(row.official.url)}" target="_blank" rel="noopener noreferrer">${safe(row.official.source)}</a>`:'Jam hanya dari screenshot; sumber resmi belum cocok secara otomatis.';
      const mismatch=verified&&row.originalWib&&row.originalWib!==row.wib?`<br><b>Jam berbeda:</b> screenshot ${safe(row.originalWib.slice(11))}; jadwal resmi ${safe(row.wib.slice(11))} WIB dipakai.`:'';
      const levelName={'very-high':'Sangat tinggi',high:'Tinggi',medium:'Sedang',watch:'Tidak langsung'}[level]||'Belum diketahui';
      const damaged=/[\[\]¥@£®]|v{3,}/i.test(row.title),period=row.title.match(/\b(MoM|YoY)\b/i)?.[0]||'';
      const title=verified||damaged&&row.key!=='OTHER'?row.name+(period?' ('+period+')':''):row.title;
      return `<article class="news-item"><span class="pill ${rel?'warn':''}">${rel?'Relevan':'Pantau saja'} · ${levelName}</span><h3>${safe(title)}</h3><p><b>${safe(row.wib)} WIB · ${safe(row.currency)}</b><br>${source}${mismatch}${displayScreenshotNumbers(row)}<br>${safe(row.why)}<br><b>Aturan:</b> ${safe(windowText)}<br><b>Jika hasil rilis keluar:</b> ${safe(row.scenario)}</p></article>`;
    });
    blocked.sort((a,b)=>a.start-b.start);
    const merged=[];
    for(const item of blocked){const last=merged.at(-1);if(last&&item.start<=last.end)last.end=Math.max(last.end,item.end);else merged.push({start:item.start,end:item.end})}
    const fmt=ms=>new Date(ms).toISOString().slice(0,16).replace('T',' ');
    const hit=blocked.find(item=>Number.isFinite(plannedMs)&&plannedMs>=item.start&&plannedMs<=item.end);
    const banner=hit?`<strong>TUNDA entry ${safe(pair)} pada ${safe(planned)} WIB.</strong><p>Berdekatan dengan ${safe(hit.row.title)}. Tunggu lewat jeda dan lihat spread/volatilitas lagi.</p>`:`<strong>${Number.isFinite(plannedMs)?'Jam rencana tidak masuk jeda berita yang terbaca.':'Jadwal berita yang terbaca'}</strong><p>Ini hanya filter berita dari screenshot, bukan sinyal entry atau jaminan tidak ada berita lain. Pastikan spread dan setup sesuai aturanmu.</p>`;
    const windows=merged.length?merged.map(x=>fmt(x.start)+'–'+fmt(x.end)+' WIB').join('<br>'):'Tidak ada rentang larangan otomatis untuk pair ini.';
    const sourceNote=feedInfo?`Pencocokan daring: ${safe(feedInfo)}`:'Jadwal resmi daring tidak tersedia; hasil hanya berdasarkan screenshot.';
    view.innerHTML=`<div class="result-box">${banner}<p><b>Rentang hindari entry ${safe(pair)}:</b><br>${windows}</p><p class="help">${sourceNote} Berita yang tidak cocok dengan sumber resmi diberi label screenshot. Jeda berita adalah aturan kehati-hatian, bukan hasil backtest.</p></div>${cards.join('')}`;
  }

  async function readOfficialFeed() {
    const response=await fetch('official-news.json?v='+Date.now(),{cache:'no-store'});
    if(!response.ok)throw Error('Data jadwal resmi tidak tersedia ('+response.status+').');
    const feed=await response.json();
    if(!feed||!Array.isArray(feed.events))throw Error('Format data jadwal resmi tidak valid.');
    return feed;
  }

  async function loadTesseract() {
    if(window.Tesseract)return;
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.onload=resolve;script.onerror=()=>reject(Error('OCR tidak dapat dimuat. Periksa koneksi internet.'));
      document.head.append(script);
    });
  }

  $('newsImageFiles').addEventListener('change',event=>{imageFiles=[...event.target.files];$('newsImageStatus').textContent=imageFiles.length?imageFiles.length+' screenshot siap dianalisis.':'Pilih screenshot untuk memulai.'});
  $('analyzeNewsImage').addEventListener('click',async()=>{
    const status=$('newsImageStatus'),button=$('analyzeNewsImage');
    if(!imageFiles.length){status.textContent='Pilih screenshot kalender ekonomi terlebih dahulu.';return}
    if(!navigator.onLine){status.textContent='Fitur ini memerlukan internet. Sambungkan perangkat lalu coba lagi.';return}
    button.disabled=true;$('newsImageResult').innerHTML='';
    let worker;
    try{
      status.textContent='Mengambil jadwal resmi dan menyiapkan pembacaan screenshot…';
      const feedPromise=readOfficialFeed().catch(()=>null);
      await loadTesseract();worker=await window.Tesseract.createWorker('eng');
      const rows=[];
      for(let i=0;i<imageFiles.length;i++){
        status.textContent=`Membaca screenshot ${i+1}/${imageFiles.length}…`;
        const result=await worker.recognize(imageFiles[i]);
        rows.push(...parseEvents(result.data.text||'',$('newsDate').value,$('newsScreenshotZone').value));
      }
      const feed=await feedPromise;
      const unique=[...new Map(rows.map(row=>[row.date+'|'+row.shownTime+'|'+row.currency+'|'+row.title.toLowerCase(),row])).values()];
      for(const row of unique){
        let official=feed&&readFeedEvent(feed,row);
        if(!official&&feed&&row.currency==='USD'&&/(?:\[|i|l)?hk\b/i.test(row.title)){
          official=feed.events.find(x=>x.key==='US_CPI'&&x.dateWib===row.wib.slice(0,10)&&x.timeWib===row.wib.slice(11));
          if(official)Object.assign(row,classify('IHK','USD'));
        }
        if(official){row.official=official;row.originalWib=row.wib;row.wib=official.dateWib+' '+official.timeWib}
      }
      const pair=($('newsPair').value||'XAUUSD').trim().toUpperCase();
      const planned=$('newsDate').value+' '+$('newsTradeTime').value;
      const before=Number($('newsBefore').value),after=Number($('newsAfter').value);
      recommendation(unique,pair,planned,Number.isFinite(before)?Math.max(0,before):60,Number.isFinite(after)?Math.max(0,after):120,feed?.updatedAt?`sumber BLS diperbarui ${feed.updatedAt.slice(0,16)} UTC; hanya berita BLS yang dapat dicocokkan secara resmi.`:null);
      status.textContent=`${unique.length} baris berita terbaca dari ${imageFiles.length} screenshot. Foto tidak diunggah ke server.`;
    }catch(error){status.textContent='Analisis belum selesai: '+(error.message||error);$('newsImageResult').innerHTML='<div class="result-box">Tidak ada rekomendasi dibuat dari pembacaan yang gagal.</div>'}
    finally{if(worker)await worker.terminate();button.disabled=false}
  });
})();
