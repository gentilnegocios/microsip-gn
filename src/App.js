import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import texLogo from './assets/tex_logo.png';

function App() {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const topRef = useRef(null);

  // Salva contatos no localStorage sempre que mudam
  const saveToLocal = (contactsList) => {
    localStorage.setItem('microsip_contacts', JSON.stringify(contactsList));
    localStorage.setItem('microsip_contacts_timestamp', Date.now().toString());
  };

  const loadFromLocal = () => {
    const saved = localStorage.getItem('microsip_contacts');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  };

  const loadContacts = useCallback((forceRemote = false) => {
    // Se não forçar remoto, tenta carregar do localStorage primeiro
    if (!forceRemote) {
      const localContacts = loadFromLocal();
      if (localContacts && localContacts.length > 0) {
        setContacts(localContacts);
        return;
      }
    }

    setLoading(true);
    fetch('contacts.xml', { cache: 'no-store', headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' } })
      .then(response => {
        if (!response.ok) {
          throw new Error('A resposta da rede não foi boa');
        }
        return response.text();
      })
      .then(str => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(str, "text/xml");
        const xmlContacts = xmlDoc.getElementsByTagName('contact');
        const parsedContacts = Array.from(xmlContacts).map(contact => ({
          name: contact.getAttribute('name'),
          number: contact.getAttribute('number')
        }));
        const sortedContacts = [...parsedContacts].sort((a, b) => a.name.localeCompare(b.name));
        setContacts(sortedContacts);
        saveToLocal(sortedContacts);
        setHasUnsavedChanges(false);
      })
      .catch(error => {
        console.error('Erro ao buscar contatos:', error);
        showMessage('Erro ao carregar contatos do servidor', 'error');
        // Fallback para localStorage
        const localContacts = loadFromLocal();
        if (localContacts) {
          setContacts(localContacts);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(''), 3000);
  };

  const addContact = () => {
    const newContacts = [...contacts, { name: '', number: '' }];
    setContacts(newContacts);
    saveToLocal(newContacts);
    setHasUnsavedChanges(true);
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  const updateContact = (index, key, value) => {
    const updatedContacts = contacts.map((contact, i) => {
      if (i === index) {
        return { ...contact, [key]: value };
      }
      return contact;
    });
    setContacts(updatedContacts);
    saveToLocal(updatedContacts);
    setHasUnsavedChanges(true);
  };

  const deleteContact = (index) => {
    const newContacts = contacts.filter((_, i) => i !== index);
    setContacts(newContacts);
    saveToLocal(newContacts);
    setHasUnsavedChanges(true);
  };

  const buildXmlBlob = () => {
    const contactsXML = `<?xml version="1.0"?>\n<contacts>\n${contacts.map(contact =>
      `  <contact name="${contact.name}" number="${contact.number}" info="Not online" presence="1" directory="1" />`
    ).join('\n')}\n</contacts>`;

    const blob = new Blob([contactsXML], { type: 'application/xml' });
    return blob;
  };

  const updateOnGitHub = async () => {
    setLoading(true);
    showMessage('Enviando para o GitHub...', 'info');

    try {
      const xmlString = buildXmlBlob();
      const base64data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(xmlString);
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      });

      const githubToken = process.env.REACT_APP_GITHUB_TOKEN;
      if (!githubToken) {
        showMessage('Token do GitHub não configurado! Verifique REACT_APP_GITHUB_TOKEN', 'error');
        setLoading(false);
        return;
      }

      const repoOwner = 'gentilnegocios';
      const repoName = 'microsip-gn';
      const path = 'public/contacts.xml';

      // Obter SHA atual
      const shaResponse = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!shaResponse.ok) {
        const errorData = await shaResponse.json();
        throw new Error(`Erro ao obter SHA: ${errorData.message || shaResponse.status}`);
      }

      const shaData = await shaResponse.json();
      const sha = shaData.sha;

      // Enviar atualização
      const updateResponse = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          message: 'Update contacts.xml',
          content: base64data,
          sha
        })
      });

      const updateData = await updateResponse.json();

      if (!updateResponse.ok) {
        throw new Error(`Erro GitHub: ${updateData.message || updateResponse.status}`);
      }

      console.log('GitHub response:', updateData);
      showMessage('✅ Enviado para o GitHub com sucesso! O site atualiza em ~1 min.', 'success');
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Erro ao enviar para o GitHub:', error);
      showMessage(`❌ Erro: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const downloadContacts = () => {
    const url = URL.createObjectURL(buildXmlBlob());
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts.xml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showMessage('Download iniciado!');
  };

  const scrollToTop = () => {
    topRef.current.scrollIntoView({ behavior: 'smooth' });
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(search.toLowerCase()) ||
    contact.number.includes(search)
  );

  return (
    <div className="App">
      <div ref={topRef} id="top"></div>

      <header className="app-header">
        <h1 className="title">Gerenciamento Microsip</h1>
        <p className="subtitle">
          {contacts.length} contatos cadastrados
          {hasUnsavedChanges && <span className="unsaved-badge"> • Alterações não salvas</span>}
        </p>
      </header>

      {message && (
        <div className={`toast toast-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="toolbar">
        <input
          className="search-input"
          type="text"
          placeholder="🔍 Buscar contato..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="toolbar-actions">
          <button className="btn btn-add" onClick={addContact}>+ Adicionar</button>
          <button className="btn btn-download" onClick={downloadContacts}>⬇ Baixar</button>
          <button className="btn btn-github" onClick={updateOnGitHub} disabled={loading}>
            {loading ? '⏳ Enviando...' : hasUnsavedChanges ? '☁ Salvar no GitHub *' : '☁ Enviar GitHub'}
          </button>
          <button className="btn btn-refresh" onClick={() => loadContacts(true)} disabled={loading}>
            🔄 Buscar do Servidor
          </button>
        </div>
      </div>

      {loading && <div className="loading-bar"></div>}

      <div className="contacts-list">
        {filteredContacts.map((contact, index) => {
          const realIndex = contacts.indexOf(contact);
          return (
            <div className="contact-card" key={realIndex}>
              <div className="contact-fields">
                <input
                  className="form form-name"
                  type="text"
                  placeholder="Nome do contato"
                  value={contact.name.toUpperCase()}
                  onChange={(e) => updateContact(realIndex, 'name', e.target.value)}
                />
                <input
                  className="form form-number"
                  type="text"
                  placeholder="Número"
                  value={contact.number}
                  onChange={(e) => updateContact(realIndex, 'number', e.target.value)}
                />
              </div>
              <button className="btn btn-delete" onClick={() => deleteContact(realIndex)} title="Remover contato">
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <button className="btn-float btn-tex" onClick={scrollToTop} title="Voltar ao topo">
        <img src={texLogo} alt="Tex" className='img-tex'></img>
      </button>
    </div>
  );
}

export default App;
