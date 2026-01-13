// Articles Module
import { api, apiUpload, API_BASE, getToken } from './api.js';
import { formatDate, escapeHtml, renderPagination } from './utils.js';

let articlePage = 1;
let editingArticleId = null;
let selectedArticleIds = [];
let editor = null;

export async function loadArticles() {
  try {
    const category = document.getElementById('article-category-filter')?.value || '';
    const status = document.getElementById('article-status-filter')?.value || '';
    const keyword = document.getElementById('article-search')?.value || '';
    
    const data = await api(`/articles?page=${articlePage}&page_size=20&category_id=${category}&status=${status}&keyword=${keyword}`);
    
    if (data.success) {
      const { articles, total, page, pageSize } = data.data;
      
      document.getElementById('articles-body').innerHTML = (articles || []).map(a => `
        <tr>
          <td><input type="checkbox" class="article-checkbox" value="${a.id}" /></td>
          <td>${a.title}</td>
          <td>${a.category_name || '-'}</td>
          <td><span class="badge ${a.is_published ? 'published' : 'draft'}">${a.is_published ? 'Published' : 'Draft'}</span></td>
          <td>${a.view_count}</td>
          <td>${formatDate(a.created_at)}</td>
          <td class="actions">
            <button class="action-btn" onclick="window.AdminArticles.edit(${a.id})"><i class="fa-solid fa-edit"></i></button>
            <button class="action-btn delete" onclick="window.AdminArticles.delete(${a.id})"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--muted)">No articles</td></tr>';

      document.querySelectorAll('.article-checkbox').forEach(cb => {
        cb.addEventListener('change', updateSelectedArticles);
      });

      renderPagination('articles-pagination', total, page, pageSize, (p) => {
        articlePage = p;
        loadArticles();
      });
    }
  } catch (err) {
    console.error('Articles error:', err);
  }
}

export async function loadCategoryOptions() {
  try {
    const data = await api('/categories');
    if (data.success) {
      const options = '<option value="">Select Category</option>' + 
        (data.data || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      
      const categorySelect = document.getElementById('article-category');
      const filterSelect = document.getElementById('article-category-filter');
      if (categorySelect) categorySelect.innerHTML = options;
      if (filterSelect) filterSelect.innerHTML = '<option value="">All Categories</option>' + 
        (data.data || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
  } catch (err) {
    console.error('Categories error:', err);
  }
}

export function openEditor() {
  editingArticleId = null;
  document.getElementById('article-title').value = '';
  document.getElementById('article-summary').value = '';
  document.getElementById('article-cover').value = '';
  document.getElementById('article-published').checked = false;
  document.getElementById('article-recommended').checked = false;
  const preview = document.getElementById('coverPreview');
  const placeholder = document.getElementById('coverPlaceholder');
  if (preview) preview.style.display = 'none';
  if (placeholder) placeholder.style.display = 'block';
  loadCategoryOptions();
  window.navigateTo('article-editor');
}

export function closeEditor() {
  if (editor && editor.destroy) {
    editor.destroy();
    editor = null;
  }
  window.navigateTo('articles');
}

export function initEditor() {
  // Destroy existing editor if any
  if (editor) {
    try { editor.destroy(); } catch(e) {}
    editor = null;
  }
  
  // Wait for Editor.js to be loaded
  if (!window.EditorJS) {
    console.error('EditorJS not loaded yet');
    setTimeout(initEditor, 100);
    return;
  }
  
  console.log('Initializing Editor.js...');
  console.log('Available globals:', { 
    EditorJS: !!window.EditorJS, 
    Header: !!window.Header, 
    List: !!window.List,
    Quote: !!window.Quote,
    CodeTool: !!window.CodeTool,
    Delimiter: !!window.Delimiter,
    ImageTool: !!window.ImageTool,
    Table: !!window.Table
  });
  
  // Build tools config - only include tools that are loaded
  const toolsConfig = {};
  
  if (window.Header) {
    toolsConfig.header = {
      class: window.Header,
      inlineToolbar: true,
      config: {
        placeholder: 'Enter a heading',
        levels: [1, 2, 3, 4, 5, 6],
        defaultLevel: 2
      }
    };
  }
  
  if (window.List) {
    toolsConfig.list = {
      class: window.List,
      inlineToolbar: true,
      config: {
        defaultStyle: 'unordered'
      }
    };
  }
  
  if (window.Quote) {
    toolsConfig.quote = {
      class: window.Quote,
      inlineToolbar: true,
      config: {
        quotePlaceholder: 'Enter a quote',
        captionPlaceholder: 'Quote author'
      }
    };
  }
  
  if (window.CodeTool) {
    toolsConfig.code = {
      class: window.CodeTool,
      config: {
        placeholder: 'Enter code'
      }
    };
  }
  
  if (window.Delimiter) {
    toolsConfig.delimiter = window.Delimiter;
  }
  
  if (window.ImageTool) {
    toolsConfig.image = {
      class: window.ImageTool,
      config: {
        uploader: {
          uploadByFile(file) {
            const formData = new FormData();
            formData.append('file', file);
            return fetch(`${API_BASE}/images/upload`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${getToken()}` },
              body: formData
            }).then(res => res.json()).then(data => {
              if (data.success) return { success: 1, file: { url: data.data.file_url } };
              return { success: 0 };
            });
          },
          uploadByUrl(url) {
            return Promise.resolve({
              success: 1,
              file: { url: url }
            });
          }
        }
      }
    };
  }
  
  if (window.Table) {
    toolsConfig.table = {
      class: window.Table,
      inlineToolbar: true,
      config: {
        rows: 2,
        cols: 3
      }
    };
  }
  
  if (window.InlineCode) {
    toolsConfig.inlineCode = {
      class: window.InlineCode
    };
  }
  
  if (window.Marker) {
    toolsConfig.marker = {
      class: window.Marker
    };
  }
  
  console.log('Tools config:', Object.keys(toolsConfig));
  
  editor = new window.EditorJS({
    holder: 'editorjs',
    placeholder: 'Click here and press Tab or click + to add content...',
    autofocus: false,
    tools: toolsConfig,
    onReady: () => {
      console.log('Editor.js is ready with tools:', Object.keys(toolsConfig));
    }
  });
  
  setupCoverUpload();
}

function setupCoverUpload() {
  const coverUpload = document.getElementById('coverUpload');
  const coverRemove = document.getElementById('coverRemove');
  
  coverUpload?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const data = await apiUpload('/images/upload', formData);
      if (data.success) {
        document.getElementById('article-cover').value = data.data.file_url;
        document.getElementById('coverPreviewImg').src = data.data.file_url;
        document.getElementById('coverPreview').style.display = 'block';
        document.getElementById('coverPlaceholder').style.display = 'none';
      }
    } catch (err) {
      console.error('Cover upload error:', err);
    }
  });
  
  coverRemove?.addEventListener('click', () => {
    document.getElementById('article-cover').value = '';
    document.getElementById('coverPreview').style.display = 'none';
    document.getElementById('coverPlaceholder').style.display = 'block';
  });
}

function editorDataToHtml(editorData) {
  let html = '';
  editorData.blocks.forEach(block => {
    switch (block.type) {
      case 'paragraph': html += `<p>${block.data.text}</p>`; break;
      case 'header': html += `<h${block.data.level}>${block.data.text}</h${block.data.level}>`; break;
      case 'list':
        const tag = block.data.style === 'ordered' ? 'ol' : 'ul';
        html += `<${tag}>${block.data.items.map(i => `<li>${i}</li>`).join('')}</${tag}>`;
        break;
      case 'quote':
        html += `<blockquote><p>${block.data.text}</p>${block.data.caption ? `<cite>${block.data.caption}</cite>` : ''}</blockquote>`;
        break;
      case 'code': html += `<pre><code>${block.data.code}</code></pre>`; break;
      case 'delimiter': html += `<hr>`; break;
      case 'image':
        html += `<figure><img src="${block.data.file.url}" alt="${block.data.caption || ''}" />${block.data.caption ? `<figcaption>${block.data.caption}</figcaption>` : ''}</figure>`;
        break;
      case 'table':
        html += '<table>' + block.data.content.map((row, i) => 
          '<tr>' + row.map(cell => `<${block.data.withHeadings && i === 0 ? 'th' : 'td'}>${cell}</${block.data.withHeadings && i === 0 ? 'th' : 'td'}>`).join('') + '</tr>'
        ).join('') + '</table>';
        break;
    }
  });
  return html;
}

export async function editArticle(id) {
  try {
    const data = await api(`/articles/${id}`);
    if (data.success) {
      editingArticleId = id;
      const a = data.data;
      loadCategoryOptions();
      window.navigateTo('article-editor');
      
      setTimeout(() => {
        document.getElementById('article-title').value = a.title;
        document.getElementById('article-summary').value = a.summary || '';
        document.getElementById('article-category').value = a.category_id || '';
        document.getElementById('article-published').checked = a.is_published;
        document.getElementById('article-recommended').checked = a.is_recommended;
        
        if (a.cover_image) {
          document.getElementById('article-cover').value = a.cover_image;
          document.getElementById('coverPreviewImg').src = a.cover_image;
          document.getElementById('coverPreview').style.display = 'block';
          document.getElementById('coverPlaceholder').style.display = 'none';
        }
        
        if (a.content_json && editor) {
          try { editor.render(JSON.parse(a.content_json)); } catch (e) {}
        }
      }, 100);
    }
  } catch (err) {
    console.error('Edit article error:', err);
  }
}

export async function saveArticle() {
  const title = document.getElementById('article-title').value;
  if (!title.trim()) { alert('Please enter a title'); return; }
  
  let content = '', contentJson = '';
  if (editor) {
    try {
      const editorData = await editor.save();
      contentJson = JSON.stringify(editorData);
      content = editorDataToHtml(editorData);
    } catch (e) { console.error('Editor save error:', e); }
  }
  
  const payload = {
    title,
    category_id: document.getElementById('article-category').value ? parseInt(document.getElementById('article-category').value) : null,
    cover_image: document.getElementById('article-cover').value,
    summary: document.getElementById('article-summary').value,
    content,
    content_json: contentJson,
    is_published: document.getElementById('article-published').checked,
    is_recommended: document.getElementById('article-recommended').checked
  };

  try {
    const endpoint = editingArticleId ? `/articles/${editingArticleId}` : '/articles';
    const method = editingArticleId ? 'PUT' : 'POST';
    const data = await api(endpoint, { method, body: JSON.stringify(payload) });
    if (data.success) closeEditor();
    else alert(data.error || 'Save failed');
  } catch (err) {
    console.error('Save article error:', err);
  }
}

export async function deleteArticle(id) {
  if (!confirm('Delete this article?')) return;
  try {
    const data = await api(`/articles/${id}`, { method: 'DELETE' });
    if (data.success) loadArticles();
  } catch (err) {
    console.error('Delete article error:', err);
  }
}

function updateSelectedArticles() {
  selectedArticleIds = Array.from(document.querySelectorAll('.article-checkbox:checked')).map(cb => parseInt(cb.value));
  const btn = document.getElementById('batch-delete-btn');
  if (btn) btn.classList.toggle('hidden', selectedArticleIds.length === 0);
}

export function toggleSelectAll(e) {
  document.querySelectorAll('.article-checkbox').forEach(cb => cb.checked = e.target.checked);
  updateSelectedArticles();
}

export async function batchDelete() {
  if (selectedArticleIds.length === 0) return;
  if (!confirm(`Delete ${selectedArticleIds.length} articles?`)) return;
  
  try {
    const data = await api('/articles/batch-delete', { method: 'POST', body: JSON.stringify({ ids: selectedArticleIds }) });
    if (data.success) { selectedArticleIds = []; loadArticles(); }
  } catch (err) {
    console.error('Batch delete error:', err);
  }
}

export function setPage(p) { articlePage = p; }

// Expose to window for onclick handlers
window.AdminArticles = {
  edit: editArticle,
  delete: deleteArticle,
  save: saveArticle,
  openEditor,
  closeEditor
};
