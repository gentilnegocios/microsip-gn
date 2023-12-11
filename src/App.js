import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [contacts, setContacts] = useState([]);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = () => {
    fetch('contacts.xml')
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
        setContacts(parsedContacts);
      })
      .catch(error => {
        console.error('Erro ao buscar contatos:', error);
      });
  };

  const addContact = () => {
    setContacts([...contacts, { name: '', number: '' }]);
  };

  const updateContact = (index, key, value) => {
    const updatedContacts = contacts.map((contact, i) => {
      if (i === index) {
        return { ...contact, [key]: value };
      }
      return contact;
    });
    setContacts(updatedContacts);
  };

  const deleteContact = (index) => {
    setContacts(contacts.filter((_, i) => i !== index));
  };

  const buildXmlBlob = () => {
    const contactsXML = `<?xml version="1.0"?> <contacts>${contacts.map(contact =>
      `<contact name="${contact.name}" number="${contact.number}" />`
    ).join('')}</contacts>`;

    const blob = new Blob([contactsXML], { type: 'application/xml' });
    return blob;
  }

  const updateOnGitHub = () => {

    const xmlString = buildXmlBlob();
    const reader = new FileReader();
    reader.readAsDataURL(xmlString);

    reader.onloadend = async function() {
      const base64data = reader.result.split(',')[1]; // Remove o cabeçalho da string base64

      const githubToken = process.env.REACT_APP_GITHUB_TOKEN;
      const repoOwner = 'devgentilnegocios';
      const repoName = 'microsip-gn';
      const path = 'public/contacts.xml';
      const message = 'Update contacts.xml';
      const content = base64data; // A string base64 do seu arquivo XML

      const getSha = async () => {
        try {
          const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${githubToken}`,
              'Content-Type': 'application/json'
            }
          });

          const data = await response.json();
          return data.sha;
        } catch (error) {
          console.error('Erro ao obter o SHA do arquivo:', error);
          return null;
        }
      };

      const sha = await getSha(); // Obter o SHA do arquivo atual
      if (!sha) {
        console.error('Não foi possível obter o SHA do arquivo.');
        return;
      }

      fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Content-Type': 'application/json',
                'X-GitHub-Api-Version': '2022-11-28'
            },
            body: JSON.stringify({
                message,
                content,
                sha
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log(data);
        })
        .catch(error => {
            console.error('Erro ao enviar o arquivo para o GitHub:', error);
        });

    }
  };

  const downloadContacts = () => {
    const url = URL.createObjectURL(buildXmlBlob());
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts.xml';
    document.body.appendChild(a); // Append to the body
    a.click();
    document.body.removeChild(a); // Now remove it
  }

  return (
    <div className="App">
      {contacts.map((contact, index) => (
        <div key={index}>
          <input
            type="text"
            placeholder="Nome do contato"
            value={contact.name}
            onChange={(e) => updateContact(index, 'name', e.target.value)}
          />
          <input
            type="text"
            placeholder="Número"
            value={contact.number}
            onChange={(e) => updateContact(index, 'number', e.target.value)}
          />
          <button onClick={() => deleteContact(index)}>Delete</button>
        </div>
      ))}

      <button onClick={addContact}>Adicionar Contao</button>
      <button onClick={downloadContacts}>Baixar Contatos</button>
      <button onClick={updateOnGitHub}>Enviar para o GitHUb</button>
    </div>
  );
}

export default App;
