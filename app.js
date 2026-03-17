const express = require('express');
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const app = express();
const PORT = process.env.PORT || 20000;
const WORKSPACE = process.env.WORKSPACE || '/home/jacobclaaaaaw/.openclaw/workspace/fileflow-data';
const ARCHIVE_DIR = path.join(WORKSPACE, 'archive');
const VERSIONS_DIR = path.join(WORKSPACE, 'md-workspace', 'versions');

function escapeHtml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function mdToHtml(md) {
    if (!md) return '';
    md = md.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    md = md.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    md = md.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    md = md.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    md = md.replace(/\*(.*?)\*/gim, '<em>$1</em>');
    md = md.replace(/`(.*?)`/gim, '<code>$1</code>');
    md = md.replace(/\n/g, '<br>');
    return md;
}

function getHeadings(md) {
    const headings = [];
    const lines = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    lines.forEach((line, i) => {
        const match = line.match(/^(#{1,3})\s+(.+)$/);
        if (match) {
            const level = match[1].length;
            const text = match[2].trim();
            const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            headings.push({ level, text, id, line: i });
        }
    });
    return headings;
}

function generateToc(headings) {
    if (headings.length === 0) return '';
    let html = '<div id="toc" style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:16px;padding:20px;height:fit-content;position:sticky;top:20px">';
    html += '<div style="font-weight:600;color:var(--text-secondary);font-size:0.8rem;text-transform:uppercase;margin-bottom:12px">📑 Table of Contents</div>';
    html += '<div style="display:flex;flex-direction:column;gap:8px">';
    headings.forEach(h => {
        const indent = (h.level - 1) * 16;
        html += '<a href="#' + h.id + '" style="color:var(--text-primary);text-decoration:none;font-size:0.9rem;padding:4px 0;padding-left:' + indent + 'px;border-left:2px solid transparent;transition:all 0.2s;display:block" onmouseover="this.style.borderLeftColor=\'var(--accent)\';this.style.paddingLeft:' + (indent + 4) + 'px" onmouseout="this.style.borderLeftColor=\'transparent\';this.style.paddingLeft:' + indent + 'px">' + h.text + '</a>';
    });
    html += '</div></div>';
    return html;
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
if (!fs.existsSync(VERSIONS_DIR)) fs.mkdirSync(VERSIONS_DIR, { recursive: true });

function getMarkdownFiles() {
    return fs.readdirSync(WORKSPACE)
        .filter(f => f.endsWith('.md') && !f.startsWith('.'))
        .map(f => {
            const filePath = path.join(WORKSPACE, f);
            const stats = fs.statSync(filePath);
            const content = fs.readFileSync(filePath, 'utf-8');
            const { content: body } = matter(content);
            const title = body.split('\n')[0].replace(/^#+\s*/, '').trim() || f.replace('.md', '');
            return { name: f, modified: stats.mtime, size: stats.size, title: title.substring(0, 40) };
        })
        .sort((a, b) => new Date(b.modified) - new Date(a.modified));
}

const CSS = `
:root {
    --bg-primary: #0a0a0f;
    --bg-secondary: #12121a;
    --bg-tertiary: #1a1a25;
    --text-primary: #f0f0f5;
    --text-secondary: #8888a0;
    --accent: #6366f1;
    --border: #2a2a3a;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
    min-height: 100vh;
    line-height: 1.6;
    background-image: radial-gradient(ellipse at 20% 0%, rgba(99,102,241,0.15) 0%, transparent 50%);
}
.container { max-width: 100%; margin: 0 auto; padding: 20px; }
header { text-align: center; margin-bottom: 60px; }
header h1 {
    font-size: 3rem;
    font-weight: 700;
    background: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 16px;
}
.file-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 24px; }
@media (max-width: 768px) { .file-grid { grid-template-columns: 1fr; } }
.file-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 28px;
    transition: all 0.4s;
}
.file-card:hover {
    transform: translateY(-8px);
    border-color: var(--accent);
    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
}
.file-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.file-icon { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
.file-name { font-family: monospace; font-size: 0.9rem; color: var(--text-secondary); background: var(--bg-tertiary); padding: 4px 10px; border-radius: 6px; margin-top: 8px; }
.file-title { font-size: 1.3rem; font-weight: 600; margin-bottom: 8px; }
.file-desc { font-size: 0.95rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 20px; }
.file-meta { display: flex; gap: 16px; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 20px; }
.file-actions { display: flex; gap: 10px; padding-top: 16px; border-top: 1px solid var(--border); margin-top: auto; }
.btn { padding: 10px 18px; border: none; border-radius: 10px; cursor: pointer; font-size: 0.9rem; font-weight: 500; text-decoration: none; transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px; }
.btn-primary { background: var(--accent); color: white; flex: 1; justify-content: center; }
.btn-primary:hover { background: #818cf8; }
.btn-secondary { background: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--border); }
.btn-secondary:hover { background: #22222f; color: var(--text-primary); }
.nav-section { display: flex; justify-content: center; margin-top: 50px; }
.nav-link { display: inline-flex; align-items: center; gap: 10px; color: var(--text-secondary); text-decoration: none; padding: 14px 28px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 14px; font-weight: 500; }
.nav-link:hover { background: var(--bg-tertiary); border-color: var(--accent); color: var(--text-primary); }
.search-bar { max-width: 500px; margin: 0 auto 30px; position: relative; }
.search-bar input { width: 100%; padding: 16px 24px 16px 50px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 14px; color: var(--text-primary); font-size: 1rem; outline: none; }
.search-bar input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(99,102,241,0.3); }
.search-bar::before { content: '🔍'; position: absolute; left: 18px; top: 50%; transform: translateY(-50%); font-size: 1.2rem; }
`;

app.get('/', (req, res) => {
    const files = getMarkdownFiles();
    let html = '<!DOCTYPE html><html><head><title>FileFlow</title>';
    html += '<style>' + CSS + '</style></head><body>';
    html += '<div class="container"><header><h1>FileFlow</h1><p>Your documents, organized</p></header>';
    html += '<div class="search-bar"><input type="text" id="searchInput" placeholder="Search files..." oninput="filterFiles()"></div>';
    
    if (files.length === 0) {
        html += '<p style="text-align:center;color:var(--text-secondary);padding:60px">No files yet</p>';
    } else {
        html += '<div class="file-grid" id="fileGrid">';
        files.forEach(f => {
            const desc = f.title || 'No description';
            html += '<div class="file-card" data-title="' + f.title.toLowerCase() + '" data-name="' + f.name.toLowerCase() + '">';
            html += '<div class="file-header"><div class="file-icon">📄</div><div class="file-name">' + escapeHtml(f.name) + '</div></div>';
            html += '<div class="file-title">' + escapeHtml(f.title) + '</div>';
            html += '<div class="file-meta"><span>📅 ' + new Date(f.modified).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + '</span><span>📊 ' + (f.size/1024).toFixed(1) + ' KB</span></div>';
            html += '<div class="file-actions">';
            html += '<a href="/view/' + encodeURIComponent(f.name) + '" class="btn btn-primary">✏️️ Edit</a>';
            html += '<form method="POST" action="/archive/' + encodeURIComponent(f.name) + '" style="display:inline"><button type="submit" class="btn btn-secondary" onclick="return confirm(\'Archive?\')">📦</button></form>';
            html += '</div></div>';
        });
        html += '</div>';
    }
    html += '<div class="nav-section"><a href="/archive" class="nav-link">📦 View Archive →</a></div>';
    html += '</div>';
    html += '<script>function filterFiles(){var q=document.getElementById("searchInput").value.toLowerCase();document.querySelectorAll("#fileGrid .file-card").forEach(function(c){var m=c.dataset.title.includes(q)||c.dataset.name.includes(q);c.style.display=m?"flex":"none"})};</script>';
    html += '</body></html>';
    res.send(html);
});

app.get('/view/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(WORKSPACE, filename);
    if (!fs.existsSync(filePath)) return res.status(404).send('File not found');
    const content = fs.readFileSync(filePath, 'utf-8');
    const { content: body } = matter(content);
    
    // Generate TOC
    const headings = getHeadings(body);
    const tocHtml = generateToc(headings);
    
    let html = '<!DOCTYPE html><html><head><title>' + escapeHtml(filename) + '</title>';
    html += '<style>' + CSS + '</style></head><body>';
    html += '<div class="container">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:30px;flex-wrap:wrap;gap:20px;padding:24px 32px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:20px">';
    html += '<div style="display:flex;align-items:center;gap:20px"><div style="width:56px;height:56px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:1.8rem;background:linear-gradient(135deg,#6366f1,#a855f7)">📝</div>';
    html += '<div><h1 style="font-size:1.2rem;font-weight:500;margin:0">' + escapeHtml(filename) + '</h1></div></div>';
    html += '<div style="display:flex;gap:12px">';
    html += '<a href="/" class="btn btn-secondary">← Back</a>';
    html += '<a href="/versions/' + encodeURIComponent(filename) + '" class="btn btn-secondary">📜 Versions</a>';
    html += '<form method="POST" action="/archive/' + encodeURIComponent(filename) + '"><button type="submit" class="btn" style="background:transparent;color:#f59e0b;border:1px solid #f59e0b">📦 Archive</button></form>';
    html += '<form method="POST" action="/save/' + encodeURIComponent(filename) + '" id="saveForm"><input type="hidden" name="content" id="hiddenContent"><button type="submit" class="btn btn-primary" onclick="document.getElementById(\'hiddenContent\').value=document.getElementById(\'editor\').value">💾 Save</button></form>';
    html += '</div></div>';
    html += '<div style="display:grid;grid-template-columns:250px 1fr 1fr;gap:24px;height:calc(100vh - 280px);min-height:500px" class="editor-grid">';
    html += '<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>';
    html += '<style>@media (max-width: 768px) {.editor-grid{grid-template-columns:1fr !important;grid-template-rows:auto 1fr 1fr !important;height:85vh !important;min-height:500px !important}.editor-grid>div{height:100% !important;min-height:0 !important;flex:none !important}.toc-sidebar{margin-bottom:20px !important}}</style>';
    html += '<style>#preview table{border-collapse:collapse;width:100%;margin:16px 0}#preview th,#preview td{border:1px solid var(--border);padding:10px 14px;text-align:left}#preview th{background:var(--bg-tertiary);font-weight:600}#preview tr:nth-child(even){background:rgba(255,255,255,0.02)}#preview{padding:24px;overflow-y:auto}#preview h1,#preview h2,#preview h3{margin-top:24px;margin-bottom:12px}#preview p{margin:12px 0;line-height:1.7}#preview code{background:var(--bg-tertiary);padding:2px 6px;border-radius:4px;font-size:0.9em}#preview pre{background:var(--bg-tertiary);padding:16px;border-radius:8px;overflow-x:auto;margin:12px 0}#preview pre code{background:none;padding:0}</style>';
    html += '<div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:20px;overflow:hidden">' + tocHtml + '</div>';
    html += '<div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:20px;overflow:hidden;display:flex;flex-direction:column;flex:1;min-height:0">';
    html += '<div style="padding:16px 24px;background:var(--bg-tertiary);border-bottom:1px solid var(--border);font-weight:600;color:var(--text-secondary);font-size:0.8rem;text-transform:uppercase">Markdown</div>';
    html += '<textarea id="editor" style="flex:1;width:100%;padding:24px;background:transparent;border:none;color:var(--text-primary);font-family:monospace;font-size:14px;line-height:1.8;resize:none;outline:none;min-height:0">' + escapeHtml(body) + '</textarea></div>';
    html += '<div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:20px;overflow:hidden;display:flex;flex-direction:column;flex:1;min-height:0">';
    html += '<div style="padding:16px 24px;background:var(--bg-tertiary);border-bottom:1px solid var(--border);font-weight:600;color:var(--text-secondary);font-size:0.8rem;text-transform:uppercase">Preview</div>';
    html += '<div id="preview" style="flex:1;padding:24px;overflow-y:auto;color:var(--text-primary);line-height:1.8;min-height:0"></div></div></div></div>';
    html += '<script>setTimeout(function(){marked.use({gfm:true,breaks:true});var t=document.getElementById("editor"),p=document.getElementById("preview");function up(){p.innerHTML=marked.parse(t.value);var hs=p.querySelectorAll("h1,h2,h3");hs.forEach(function(h){var id=h.textContent.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");h.id=id})};t.addEventListener("input",up);up();},0);</script>';
    html += '</body></html>';
    res.send(html);
});

app.post('/save/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(WORKSPACE, filename);
    if (fs.existsSync(filePath)) {
        const old = fs.readFileSync(filePath, 'utf-8');
        if (old !== req.body.content) {
            const v = filename.replace('.md', '') + '_' + new Date().toISOString().replace(/[:.]/g, '-') + '.md';
            fs.writeFileSync(path.join(VERSIONS_DIR, v), old);
        }
    }
    fs.writeFileSync(filePath, req.body.content);
    res.redirect('/view/' + encodeURIComponent(filename));
});

app.get('/versions/:filename', (req, res) => {
    const filename = req.params.filename;
    const base = filename.replace('.md', '');
    let versions = [];
    if (fs.existsSync(VERSIONS_DIR)) {
        versions = fs.readdirSync(VERSIONS_DIR).filter(f => f.startsWith(base + '_') && f.endsWith('.md')).map(f => ({ filename: f, mtime: fs.statSync(path.join(VERSIONS_DIR, f)).mtime, size: fs.statSync(path.join(VERSIONS_DIR, f)).size })).sort((a, b) => b.mtime - a.mtime);
    }
    let html = '<!DOCTYPE html><html><head><title>Versions - ' + escapeHtml(filename) + '</title>';
    html += '<style>' + CSS + '</style></head><body>';
    html += '<div class="container"><header><h1>📜 Version History</h1><p>' + escapeHtml(filename) + '</p></header>';
    html += '<div style="margin-bottom:20px"><a href="/view/' + encodeURIComponent(filename) + '" class="btn btn-secondary">← Back to Editor</a></div>';
    
    if (versions.length === 0) {
        html += '<p style="text-align:center;color:var(--text-secondary);padding:40px">No versions yet. Save the file to create versions.</p>';
    } else {
        html += '<div class="file-grid">';
        versions.forEach(v => {
            html += '<div class="file-card">';
            html += '<div class="file-title">' + v.mtime.toLocaleString() + '</div>';
            html += '<div class="file-meta"><span>' + (v.size/1024).toFixed(1) + ' KB</span></div>';
            html += '<div class="file-actions">';
            html += '<a href="/view-version/' + v.filename + '" target="_blank" class="btn btn-secondary">👁 View</a>';
            html += '<form method="POST" action="/restore/' + encodeURIComponent(filename) + '" style="display:inline"><input type="hidden" name="version" value="' + v.filename + '"><button type="submit" class="btn btn-primary" onclick="return confirm(\'Restore this version?\')">🔄 Restore</button></form>';
            html += '</div></div>';
        });
        html += '</div>';
    }
    html += '</div></body></html>';
    res.send(html);
});

app.get('/view-version/:vfile', (req, res) => {
    const vfile = req.params.vfile;
    const vpath = path.join(VERSIONS_DIR, vfile);
    if (!fs.existsSync(vpath)) return res.status(404).send('Not found');
    const content = fs.readFileSync(vpath, 'utf-8');
    const html = mdToHtml(content);
    res.send('<!DOCTYPE html><html><head><title>' + escapeHtml(vfile) + '</title><style>' + CSS + '</style></head><body><div class="container"><a href="javascript:history.back()" class="btn btn-secondary">← Back</a><div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:20px;padding:30px;margin-top:20px;line-height:1.8">' + html + '</div></div></body></html>');
});

app.post('/restore/:filename', (req, res) => {
    const filename = req.params.filename;
    const vfile = req.body.version;
    const vpath = path.join(VERSIONS_DIR, vfile);
    if (fs.existsSync(vpath)) fs.writeFileSync(path.join(WORKSPACE, filename), fs.readFileSync(vpath, 'utf-8'));
    res.redirect('/view/' + encodeURIComponent(filename));
});

app.post('/archive/:filename', (req, res) => {
    const filename = req.params.filename;
    const src = path.join(WORKSPACE, filename);
    let dst = path.join(ARCHIVE_DIR, filename);
    let i = 1;
    while (fs.existsSync(dst)) { dst = path.join(ARCHIVE_DIR, filename.replace('.md', '') + '_' + i++ + '.md'); }
    fs.renameSync(src, dst);
    res.redirect('/');
});

app.get('/archive', (req, res) => {
    const files = fs.readdirSync(ARCHIVE_DIR).filter(f => f.endsWith('.md')).map(f => ({ name: f, modified: fs.statSync(path.join(ARCHIVE_DIR, f)).mtime, size: fs.statSync(path.join(ARCHIVE_DIR, f)).size })).sort((a, b) => b.modified - a.modified);
    let html = '<!DOCTYPE html><html><head><title>Archive</title>';
    html += '<style>' + CSS + '</style></head><body>';
    html += '<div class="container"><header><h1>📦 Archive</h1><p>' + files.length + ' archived document' + (files.length !== 1 ? 's' : '') + '</p></header>';
    html += '<a href="/" class="btn btn-secondary" style="margin-bottom:30px">← Back to Files</a>';
    if (files.length === 0) {
        html += '<p style="text-align:center;color:var(--text-secondary);padding:60px">No archived files</p>';
    } else {
        html += '<div class="file-grid">';
        files.forEach(f => {
            html += '<div class="file-card"><div class="file-header"><div class="file-icon">📄</div></div><div class="file-title">' + escapeHtml(f.name) + '</div><div class="file-meta"><span>' + f.modified.toLocaleDateString() + '</span><span>' + (f.size/1024).toFixed(1) + ' KB</span></div></div>';
        });
        html += '</div>';
    }
    html += '</div></body></html>';
    res.send(html);
});

app.listen(PORT, () => { console.log('Server running at http://localhost:' + PORT); });
