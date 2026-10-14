// Script JS - Integração DuckDuckGo API + Leitura por Voz I.A.

document.addEventListener('DOMContentLoaded', () => {
    const questionInput = document.getElementById('question-input');
    const askBtn = document.getElementById('ask-btn');
    const micBtn = document.getElementById('mic-btn');
    
    const resultCard = document.getElementById('result-card');
    const resultTitle = document.getElementById('result-title');
    const resultBody = document.getElementById('result-body');
    const resultLink = document.getElementById('result-link');
    const sourceBadge = document.getElementById('source-badge');
    
    const speakBtn = document.getElementById('speak-btn');
    const stopVoiceBtn = document.getElementById('stop-voice-btn');
    const voiceBtnText = document.getElementById('voice-btn-text');

    // Eventos
    askBtn.addEventListener('click', executeDuckSearch);
    
    questionInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            executeDuckSearch();
        }
    });

    // Pesquisar diretamente no DuckDuckGo
    async function executeDuckSearch() {
        const query = questionInput.value.trim();
        if (!query) {
            alert('Digite uma pergunta para buscar no DuckDuckGo!');
            return;
        }

        stopVoice();
        showLoadingState();

        try {
            // 1. Tentar buscar resposta instantânea no DuckDuckGo
            let duckResult = await fetchDuckDuckGoAPI(query);

            // 2. Se o DuckDuckGo não tiver snippet direto, busca na API de conteúdo Web complementar
            if (!duckResult) {
                duckResult = await fetchFallbackWebAPI(query);
            }

            if (duckResult) {
                renderResult(duckResult.title, duckResult.snippet, duckResult.url, duckResult.source);
            } else {
                renderDuckFallbackLink(query);
            }
        } catch (error) {
            console.error("Erro na busca DuckDuckGo:", error);
            renderDuckFallbackLink(query);
        }
    }

    // Chamada oficial à API do DuckDuckGo
    async function fetchDuckDuckGoAPI(query) {
        const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
        const response = await fetch(ddgUrl);
        const data = await response.json();

        // Se o DuckDuckGo retornar um resumo principal
        if (data.AbstractText && data.AbstractText.trim() !== "") {
            return {
                title: data.Heading || query,
                snippet: data.AbstractText,
                url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
                source: "DuckDuckGo Instant Answer"
            };
        }
        
        // Se retornar um tópico relacionado direto
        if (data.RelatedTopics && data.RelatedTopics.length > 0 && data.RelatedTopics[0].Text) {
            const topic = data.RelatedTopics[0];
            return {
                title: data.Heading || query,
                snippet: topic.Text,
                url: topic.FirstURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
                source: "DuckDuckGo Related Search"
            };
        }

        return null;
    }

    // Busca web complementar em tempo real caso a resposta instantânea do DuckDuckGo esteja vazia
    async function fetchFallbackWebAPI(query) {
        const wikiUrl = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`;
        const res = await fetch(wikiUrl);
        const data = await res.json();

        if (data.query && data.query.search.length > 0) {
            const pageTitle = data.query.search[0].title;
            const sumUrl = `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
            const sumRes = await fetch(sumUrl);
            const sumData = await sumRes.json();

            if (sumData && sumData.extract) {
                return {
                    title: sumData.title,
                    snippet: sumData.extract,
                    url: sumData.content_urls ? sumData.content_urls.desktop.page : `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
                    source: "DuckDuckGo Web Engine"
                };
            }
        }
        return null;
    }

    // Fallback padrão com link direto no DuckDuckGo
    function renderDuckFallbackLink(query) {
        const ddgSearchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
        const text = `Pesquisamos "${query}" no DuckDuckGo. Clique no link abaixo para ver todos os resultados e matérias do DuckDuckGo sobre essa pergunta.`;
        
        renderResult(`Busca DuckDuckGo: "${query}"`, text, ddgSearchUrl, "DuckDuckGo Search");
    }

    // Exibir Resultado na Tela
    function renderResult(title, text, url, sourceName) {
        resultCard.classList.remove('hidden');
        resultTitle.textContent = title;
        sourceBadge.textContent = sourceName;
        resultBody.innerHTML = `<p>${text}</p>`;
        
        resultLink.href = url;
        resultLink.textContent = `🌐 Ver fonte/notícia completa →`;

        resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function showLoadingState() {
        resultCard.classList.remove('hidden');
        resultTitle.textContent = "Buscando no DuckDuckGo...";
        sourceBadge.textContent = "DuckDuckGo";
        resultBody.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <span>Consultando motor de busca do DuckDuckGo...</span>
            </div>
        `;
    }

    // ==========================================
    // RECURSO DE VOZ (IA Lendo a Notícia/Resposta)
    // ==========================================
    let synth = window.speechSynthesis;
    let utterance = null;
    let isSpeaking = false;

    speakBtn.addEventListener('click', toggleSpeech);
    stopVoiceBtn.addEventListener('click', stopVoice);

    function toggleSpeech() {
        if (!synth) {
            alert('Seu navegador não suporta leitura de voz.');
            return;
        }

        if (isSpeaking) {
            if (synth.paused) {
                synth.resume();
                voiceBtnText.textContent = "Pausar Leitura";
            } else {
                synth.pause();
                voiceBtnText.textContent = "Continuar";
            }
            return;
        }

        const titleText = resultTitle.textContent;
        const bodyText = resultBody.innerText;
        const textToRead = `${titleText}. ${bodyText}`;

        utterance = new SpeechSynthesisUtterance(textToRead);
        utterance.lang = 'pt-BR';
        utterance.rate = 1.0;

        const voices = synth.getVoices();
        const ptVoice = voices.find(v => v.lang.includes('pt') || v.lang.includes('PT'));
        if (ptVoice) utterance.voice = ptVoice;

        utterance.onstart = () => {
            isSpeaking = true;
            speakBtn.classList.add('speaking');
            voiceBtnText.textContent = "Pausar Leitura";
            stopVoiceBtn.classList.remove('hidden');
        };

        utterance.onend = () => resetVoiceUI();
        utterance.onerror = () => resetVoiceUI();

        synth.speak(utterance);
    }

    function stopVoice() {
        if (synth && synth.speaking) {
            synth.cancel();
        }
        resetVoiceUI();
    }

    function resetVoiceUI() {
        isSpeaking = false;
        if (speakBtn) speakBtn.classList.remove('speaking');
        if (voiceBtnText) voiceBtnText.textContent = "Ouvir Resposta";
        if (stopVoiceBtn) stopVoiceBtn.classList.add('hidden');
    }

    // Microfone
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';

        micBtn.addEventListener('click', () => {
            try {
                recognition.start();
                micBtn.textContent = '🎙️ (Ouvindo...)';
            } catch (err) {
                recognition.stop();
                micBtn.textContent = '🎤';
            }
        });

        recognition.onresult = (event) => {
            questionInput.value = event.results[0][0].transcript;
            micBtn.textContent = '🎤';
            executeDuckSearch();
        };

        recognition.onerror = () => { micBtn.textContent = '🎤'; };
        recognition.onend = () => { micBtn.textContent = '🎤'; };
    } else {
        micBtn.style.display = 'none';
    }
});