(function(){
  const encoder=new TextEncoder();
  const xml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const column=n=>{let out='';for(let i=n;i;i=Math.floor((i-1)/26))out=String.fromCharCode(65+(i-1)%26)+out;return out;};
  const textCell=(ref,value,style)=>`<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  const numberCell=(ref,value,style,formula='')=>`<c r="${ref}" s="${style}">${formula?`<f>${formula}</f>`:''}<v>${Number(value)}</v></c>`;
  const row=(number,cells,height='')=>`<row r="${number}"${height?` ht="${height}" customHeight="1"`:''}>${cells.join('')}</row>`;

  let crcTable;
  function crc32(bytes){
    if(!crcTable)crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
    let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;
  }
  function u16(view,offset,value){view.setUint16(offset,value,true);}
  function u32(view,offset,value){view.setUint32(offset,value>>>0,true);}
  function dosDateTime(date){const year=Math.max(1980,date.getFullYear());return {time:(date.getHours()<<11)|(date.getMinutes()<<5)|(date.getSeconds()>>1),date:((year-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate()};}
  function zip(files){
    const now=dosDateTime(new Date()),locals=[],centrals=[];let offset=0;
    for(const file of files){
      const name=encoder.encode(file.name),data=typeof file.data==='string'?encoder.encode(file.data):file.data,crc=crc32(data);
      const local=new Uint8Array(30+name.length+data.length),lv=new DataView(local.buffer);
      u32(lv,0,0x04034b50);u16(lv,4,20);u16(lv,6,0x0800);u16(lv,8,0);u16(lv,10,now.time);u16(lv,12,now.date);u32(lv,14,crc);u32(lv,18,data.length);u32(lv,22,data.length);u16(lv,26,name.length);local.set(name,30);local.set(data,30+name.length);locals.push(local);
      const central=new Uint8Array(46+name.length),cv=new DataView(central.buffer);
      u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u16(cv,8,0x0800);u16(cv,10,0);u16(cv,12,now.time);u16(cv,14,now.date);u32(cv,16,crc);u32(cv,20,data.length);u32(cv,24,data.length);u16(cv,28,name.length);u32(cv,42,offset);central.set(name,46);centrals.push(central);offset+=local.length;
    }
    const centralSize=centrals.reduce((sum,item)=>sum+item.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);
    u32(ev,0,0x06054b50);u16(ev,8,files.length);u16(ev,10,files.length);u32(ev,12,centralSize);u32(ev,16,offset);
    const output=new Uint8Array(offset+centralSize+end.length);let at=0;for(const part of [...locals,...centrals,end]){output.set(part,at);at+=part.length;}return output;
  }

  function buildMaterialsWorkbook(materials,details={},logoBytes=null){
    const records=Array.isArray(materials)?materials:[],hasNotes=records.some(item=>(item.notes||[]).some(note=>String(note).trim()));
    const columns=hasNotes?
      [{key:'name',label:'Material',width:37},{key:'notes',label:'Notes',width:48},{key:'unit',label:'Unit',width:24},{key:'required',label:'Required quantity',width:28},{key:'cost',label:'Material cost (USD)',width:42}]:
      [{key:'name',label:'Material',width:37},{key:'unit',label:'Unit',width:24},{key:'required',label:'Required quantity',width:28},{key:'cost',label:'Material cost (USD)',width:42}];
    const headerRow=6,firstDataRow=7,lastDataRow=headerRow+records.length,totalRow=lastDataRow+1,lastColumn=column(columns.length),costColumn=column(columns.findIndex(item=>item.key==='cost')+1),total=records.reduce((sum,item)=>sum+Number(item.cost||0),0),sheetRows=[];
    const customer=details.customer||'Not specified',quoteRef=details.quoteRef||'Not set',quoteDate=details.quoteDate||'Not set',subject=details.subject||'Material requirements';
    sheetRows.push(row(1,[],8));
    sheetRows.push(row(2,[textCell('A2','ICON PANELS · MATERIAL REQUIREMENTS',1)],21));
    sheetRows.push(row(3,[textCell('A3',`Customer: ${customer}    Quotation: ${quoteRef}`,2)],15));
    sheetRows.push(row(4,[textCell('A4',`Quotation date: ${quoteDate}    Subject: ${subject}`,2)],15));
    sheetRows.push(row(5,[],8));
    sheetRows.push(row(headerRow,columns.map((item,index)=>textCell(`${column(index+1)}${headerRow}`,item.label,3)),20));
    records.forEach((item,index)=>{
      const r=firstDataRow+index,cells=columns.map((definition,columnIndex)=>{
        const ref=`${column(columnIndex+1)}${r}`;
        if(definition.key==='name')return textCell(ref,item.name,4);
        if(definition.key==='notes')return textCell(ref,(item.notes||[]).join('\n'),4);
        if(definition.key==='unit')return textCell(ref,item.unit,5);
        if(definition.key==='required')return numberCell(ref,item.required,Number.isInteger(Number(item.required))?6:7);
        return numberCell(ref,item.cost,8);
      });
      const longestText=Math.max(String(item.name||'').length,...(item.notes||[]).map(note=>String(note).length));
      sheetRows.push(row(r,cells,longestText>48?36:19));
    });
    sheetRows.push(row(totalRow,[textCell(`A${totalRow}`,'Material cost total',9),numberCell(`${costColumn}${totalRow}`,total,10,records.length?`SUM(${costColumn}${firstDataRow}:${costColumn}${lastDataRow})`:'')],16));
    const columnXml=columns.map((item,index)=>`<col min="${index+1}" max="${index+1}" width="${item.width}" customWidth="1"/>`).join('');
    const drawing=logoBytes?'<drawing r:id="rId1"/>':'';
    const worksheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:${lastColumn}${totalRow}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="6" topLeftCell="A7" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A7" sqref="A7"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${columnXml}</cols><sheetData>${sheetRows.join('')}</sheetData><autoFilter ref="A${headerRow}:${lastColumn}${Math.max(headerRow,lastDataRow)}"/><mergeCells count="4"><mergeCell ref="A2:${lastColumn}2"/><mergeCell ref="A3:${lastColumn}3"/><mergeCell ref="A4:${lastColumn}4"/><mergeCell ref="A${totalRow}:${column(columns.length-1)}${totalRow}"/></mergeCells><pageMargins left="0.35" right="0.35" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="9"/>${drawing}</worksheet>`;
    const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.####"/><numFmt numFmtId="165" formatCode="#,##0.00"/></numFmts><fonts count="5"><font><sz val="10"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="14"/><color rgb="FFD71920"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FF173F69"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FF173F69"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF173F69"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD7EAF0"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FF9AAAB7"/></left><right style="thin"><color rgb="FF9AAAB7"/></right><top style="thin"><color rgb="FF9AAAB7"/></top><bottom style="thin"><color rgb="FF9AAAB7"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="11"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="165" fontId="4" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    const created=new Date().toISOString(),contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${logoBytes?'<Default Extension="jpg" ContentType="image/jpeg"/>':''}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${logoBytes?'<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>':''}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
    const files=[
      {name:'[Content_Types].xml',data:contentTypes},
      {name:'_rels/.rels',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`},
      {name:'docProps/app.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>ICON Panels Sales Workspace</Application><AppVersion>1.0</AppVersion></Properties>`},
      {name:'docProps/core.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>ICON Panels Material Requirements</dc:title><dc:creator>ICON Panels Sales Workspace</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created></cp:coreProperties>`},
      {name:'xl/workbook.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Material requirements" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'Material requirements'!$A$${headerRow}:$${lastColumn}$${Math.max(headerRow,lastDataRow)}</definedName></definedNames><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`},
      {name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
      {name:'xl/styles.xml',data:styles},{name:'xl/worksheets/sheet1.xml',data:worksheet}
    ];
    if(logoBytes){
      files.push(
        {name:'xl/worksheets/_rels/sheet1.xml.rels',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`},
        {name:'xl/drawings/drawing1.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>60000</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>30000</xdr:rowOff></xdr:from><xdr:ext cx="1650000" cy="981000"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="ICON Panels logo"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm/><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`},
        {name:'xl/drawings/_rels/drawing1.xml.rels',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.jpg"/></Relationships>`},
        {name:'xl/media/image1.jpg',data:logoBytes}
      );
    }
    return zip(files);
  }
  async function downloadMaterialsWorkbook(materials,details={},filename='ICON-order-materials.xlsx'){
    const blob=new Blob([buildMaterialsWorkbook(materials,details)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  window.IconMaterialsExport={buildMaterialsWorkbook,downloadMaterialsWorkbook};
})();
