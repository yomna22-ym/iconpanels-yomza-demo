(function(root){
function calculate(source,state){
 const by=Object.fromEntries(source.items.map(x=>[x.col,x]));const rows=[];
 function add(col,group){const m=by[col];if(!m||typeof m.qty!=='number'||!Number.isFinite(m.rate))return; if(m.qty===0)return;const price=state.prices?.[col]??m.price??m.rate;const factor=m.price?m.rate/m.price:1;rows.push({...m,group,price,rate:price*factor,cost:m.qty*price*factor,required:m.qty*state.quantity});}
 add(state.inside,'Inside steel');add(state.outside,'Outside steel');
 const groups={PUR:['AZ','BA','BB','BC','BD'],PIR:['BE','BF','BG','BH','BI'],EPS:['BL','BM','BN','BO']};
 (groups[state.foam]||[]).forEach(c=>add(c,state.foam));
 if(state.foam==='PIR'||state.foam==='PUR'){
  add('BJ','Adhesion promoter');add('BK','Adhesion promoter');
  // C1 D34:D35 are zero for PUR, although E34:E35 still charge adhesion.
  if(state.foam==='PUR')rows.filter(r=>r.group==='Adhesion promoter').forEach(r=>{r.qty=0;r.required=0;r.quantityNote='C1 shows 0 consumption for PUR; adhesion cost is retained.';});
 }
 if(state.packing==='Plastic Roll')add('BT','Packing');['BU','BV','BX','BY'].forEach(c=>add(c,'Internal'));if(state.other==='فلكسبل')add('BZ','Other');
 const raw=rows.reduce((a,r)=>a+r.cost,0),scrap=raw*.015,fixed=raw>1?raw*.013:0,variable=raw*source.variableRate,direct=raw>1?raw*.025:0,indirect=raw*.015;
 const base=raw+scrap+fixed+variable+direct+indirect,sale=state.other==='درجة ثانية'?base:base/(1-state.margin/100);
 const factor=source.colors.find(c=>c.name===state.colour)?.factor??1,unit=Math.round(sale*factor),after=state.after??unit;
 return {rows,raw,scrap,fixed,variable,direct,indirect,base,sale,unit,after,before:unit*state.quantity,total:after*state.quantity,discount:unit?(unit-after)/unit*100:0};
}root.calculate=calculate;if(typeof module!=='undefined')module.exports=calculate;
})(globalThis);
