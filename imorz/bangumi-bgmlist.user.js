// ==UserScript==
// @name        Bangumi 国内放送站点链接
// @description 为 Bangumi 动画条目页左侧添加来自 bgmlist.tv 的国内放送站点链接
// @namespace   org.sorz.bangumi
// @include     /^https?:\/\/((bangumi|bgm)\.tv|chii.in)\/subject\/\d+$/
// @version     0.4.1
// ==/UserScript==

const BGMLIST_URL = 'https://bgmlist.sorz.org/data/items/$Y/$M.json';
const SITES_INFO_URL = 'https://bgmlist.sorz.org/data/sites/onair.json';
const FETCH_PARAMS = { referrerPolicy: "no-referrer" };

const $ = selector => document.querySelector(selector);


// return on-air date [year, month] of bgm in current page
function getOnAirYearMonth() {
  const date = Array.from(document.querySelectorAll('#infobox .tip'))
    .find(t => t.textContent.match(/^(放送开始|上映年度)/));
  if (date == undefined) throw "on-air date not found";
  let [_, year, month] = date.parentElement.textContent
    .match(/(\d{4})年(\d{1,2})月/);
  month = month.padStart(2, '0');
  return [year, month];
}

// return full bgm list on given on-air date
async function getBgmList(year, month) {
  const url = BGMLIST_URL.replace('$Y', year).replace('$M', month);
  const resp = await fetch(url, FETCH_PARAMS);
  if (!resp.ok) throw "fail to fetch bgmlist: " + resp.status;
  let list = await resp.json();
  bgms = new Map(
    list.map(bgm => {
      if (!bgm.sites) return;
      const site = bgm.sites.find(s => s.site == 'bangumi');
      if (site) return [site.id, bgm];
    }).filter(b => b)
  );
  return bgms;
}

async function getSiteInfo() {
  const resp = await fetch(SITES_INFO_URL, FETCH_PARAMS);
  if (!resp.ok) throw "fail to fetch site infos: " + resp.status;
  return await resp.json();
}

function addInfoRow(title, links) {
  let tli = document.createElement('template');
  tli.innerHTML = '<li><span class="tip"></span></li>';
  let li = tli.content.firstChild;
  li.firstChild.textContent = `${title}：`;
  let ta = document.createElement('template');
  ta.innerHTML = '<a class="l"></a>';
  let a = ta.content.firstChild;
  let dot = document.createTextNode("、");
 
  links.forEach(([href, title]) => {
    a.href = href;
    a.innerText = title;
    li.appendChild(a.cloneNode(true));
    li.appendChild(dot.cloneNode());
  });
  li.lastChild.remove();
  
  let row = document.importNode(tli.content, true);
  $("#infobox").appendChild(row);
}

function addOnAirSites(bgm, sites) {
  const links = bgm.sites.map(({site, id}) => {
    const info = sites[site];
    if (!info) return;
    const url = info.urlTemplate.replace('{{id}}', id);
    return [url, info.title];
  }).filter(u => u);
  if (links)
    addInfoRow('放送站点', links);
}

window.addEventListener('DOMContentLoaded', async () => {
  const bgmId = location.pathname.match(/\/subject\/(\d+)/)[1];
  const [year, month] = getOnAirYearMonth();
  const bgm = (await getBgmList(year, month)).get(bgmId);

  if (!bgm) throw `bangumi #${bgmId} not found in bgmlist`;
  
  const sites = await getSiteInfo();
  addOnAirSites(bgm, sites);
});

