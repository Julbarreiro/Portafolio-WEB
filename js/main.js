document.addEventListener('DOMContentLoaded', () => {
    const menuItems = document.querySelectorAll('.menu-item');
    const backBtns = document.querySelectorAll('.back-btn');
    const mainMenu = document.getElementById('main-menu');
    const categoriesContainer = document.getElementById('categories-container');
    const contentViewer = document.getElementById('content-viewer');
    const syncStatus = document.getElementById('sync-status');
    const mediaLightbox = document.getElementById('media-lightbox');
    const mediaLightboxBody = mediaLightbox.querySelector('.media-lightbox-body');
    const lightboxCaption = mediaLightbox.querySelector('.lightbox-caption');
    const lightboxPrevious = mediaLightbox.querySelector('.lightbox-previous');
    const lightboxNext = mediaLightbox.querySelector('.lightbox-next');
    const contactTrigger = document.getElementById('contact-trigger');
    const contactDialog = document.getElementById('contact-dialog');
    const contactForm = document.getElementById('contact-form');
    const contactStatus = document.getElementById('contact-status');
    const contactSuccess = document.getElementById('contact-success');
    const contactClose = contactDialog.querySelector('.contact-close');
    const profileCarousel = document.getElementById('profile-carousel-content');
    let projects = [];
    let selectedProjectId = null;
    let syncPromise = null;
    let lastSyncAt = 0;
    let lightboxImages = [];
    let lightboxImageIndex = 0;
    const refreshInterval = 5 * 60 * 1000;
    const profileImages = [
        'res_10022', 'res_10024', 'res_10025', 'res_10027', 'res_10032',
        'res_10034', 'res_10035', 'res_10037', 'res_10038', 'res_10039',
        'res_10040', 'res_10044', 'res_10046', 'res_10047', 'res_10050',
        'res_10051', 'Arduino_ESP32.jpg', 'res_10338', 'res_10628', 'res_10629',
        'res_10630', 'res_10632', 'res_10633', 'res_10634', 'res_10635'
    ];

    function resourceCandidates(reference, type) {
        if (/^https?:\/\//i.test(reference)) return [reference];
        if (!/^[a-z0-9_.-]+$/i.test(reference)) return [];

        const hasAudioExtension = type === 'audio' && /\.(m4a|mp3|wav|ogg)$/i.test(reference);
        const baseName = hasAudioExtension ? reference.replace(/\.[^.]+$/, '') : reference;
        const variants = new Set([baseName]);
        const cSuffix = baseName.match(/^(.*_c)_?(\d+)$/i);
        if (cSuffix) {
            variants.add(`${cSuffix[1]}_${cSuffix[2]}`);
            variants.add(`${cSuffix[1]}${cSuffix[2]}`);
        }

        const explicitExtension = /\.[a-z0-9]+$/i.test(reference);
        const extensions = hasAudioExtension
            ? [
                reference.match(/\.[^.]+$/)[0].toLowerCase(),
                ...['.m4a', '.wav', '.mp3', '.ogg'].filter(extension =>
                    extension !== reference.match(/\.[^.]+$/)[0].toLowerCase()
                )
            ]
            : explicitExtension
                ? ['']
                : type === 'audio'
                    ? ['.m4a', '.wav', '.mp3', '.ogg']
                    : type === 'video'
                        ? ['.mp4', '.webm', '.mov']
                        : ['.png', '.jpg', '.jpeg', '.webp'];

        const resourceFolders = ['resources/'];
        return Array.from(variants).flatMap(name =>
            resourceFolders.flatMap(folder =>
                extensions.map(extension => `${folder}${encodeURIComponent(name + extension)}`)
            )
        );
    }

    function configureAudioSources(audio, references, onFinalError = () => {}) {
        const sources = Array.from(new Set(references.flatMap(reference =>
            /^https?:\/\//i.test(reference) ? [reference] : resourceCandidates(reference, 'audio')
        )));
        let sourceIndex = 0;
        let latestError = null;

        if (!sources.length) {
            throw new Error('El proyecto no tiene una fuente de audio válida.');
        }

        function selectSource(index) {
            sourceIndex = index;
            audio.src = sources[index];
            audio.load();
        }

        audio.addEventListener('error', () => {
            latestError = audio.error || new Error('El navegador no pudo cargar la fuente de audio.');
            if (sourceIndex < sources.length - 1) {
                selectSource(sourceIndex + 1);
            } else {
                onFinalError(latestError);
            }
        });

        selectSource(sourceIndex);

        return {
            async play() {
                for (let attempt = 0; attempt < sources.length; attempt += 1) {
                    const attemptedSource = sourceIndex;
                    try {
                        await audio.play();
                        return;
                    } catch (error) {
                        latestError = error;
                        if (sourceIndex === attemptedSource && sourceIndex < sources.length - 1) {
                            selectSource(sourceIndex + 1);
                        } else if (sourceIndex === attemptedSource) {
                            throw error;
                        }
                    }
                }

                throw latestError || new Error('No se encontró una fuente de audio compatible.');
            }
        };
    }

    function renderProfileCarouselGroup(duplicate = false) {
        const group = document.createElement('div');
        group.className = 'profile-carousel-group';
        if (duplicate) group.setAttribute('aria-hidden', 'true');

        profileImages.forEach(reference => {
            const item = document.createElement('div');
            item.className = 'profile-carousel-item';

            const image = document.createElement('img');
            image.alt = duplicate ? '' : reference.replaceAll('_', ' ');
            image.loading = 'eager';
            image.decoding = 'async';
            const sources = resourceCandidates(reference, 'image');
            let sourceIndex = 0;
            image.addEventListener('error', () => {
                sourceIndex += 1;
                if (sourceIndex < sources.length) {
                    image.src = sources[sourceIndex];
                } else {
                    item.remove();
                }
            });
            image.src = sources[0];
            item.append(image);
            group.append(item);
        });

        profileCarousel.append(group);
    }

    function openMediaLightbox(content, caption) {
        lightboxImages = [];
        lightboxPrevious.hidden = true;
        lightboxNext.hidden = true;
        mediaLightboxBody.replaceChildren(content);
        lightboxCaption.textContent = caption;
        if (!mediaLightbox.open) {
            mediaLightbox.showModal();
            window.dispatchEvent(new Event('lightbox:open'));
        }
    }

    function showLightboxImage() {
        const imageData = lightboxImages[lightboxImageIndex];
        if (!imageData) return;

        const image = document.createElement('img');
        image.className = 'lightbox-image';
        image.src = imageData.src;
        image.alt = imageData.title;
        mediaLightboxBody.replaceChildren(image);
        lightboxCaption.textContent = `${imageData.title} · ${lightboxImageIndex + 1} / ${lightboxImages.length}`;
        const hasMultipleImages = lightboxImages.length > 1;
        lightboxPrevious.hidden = !hasMultipleImages;
        lightboxNext.hidden = !hasMultipleImages;
    }

    function openImageLightbox(images, selectedIndex = 0) {
        lightboxImages = images.filter(image => image.src);
        lightboxImageIndex = Math.max(0, Math.min(selectedIndex, lightboxImages.length - 1));
        if (!lightboxImages.length) return;

        showLightboxImage();
        if (!mediaLightbox.open) {
            mediaLightbox.showModal();
            window.dispatchEvent(new Event('lightbox:open'));
        }
    }

    function navigateLightbox(direction) {
        if (lightboxImages.length < 2) return;
        lightboxImageIndex = (lightboxImageIndex + direction + lightboxImages.length) % lightboxImages.length;
        showLightboxImage();
    }

    renderProfileCarouselGroup();
    renderProfileCarouselGroup(true);

    contactTrigger.addEventListener('click', () => {
        contactStatus.textContent = '';
        contactDialog.showModal();
        window.dispatchEvent(new Event('contact:open'));
        contactForm.querySelector('[name="nombre"]').focus();
    });
    contactClose.addEventListener('click', () => contactDialog.close());
    contactDialog.addEventListener('click', event => {
        if (event.target === contactDialog) contactDialog.close();
    });
    contactDialog.addEventListener('close', () => {
        window.dispatchEvent(new Event('contact:close'));
        if (!contactSuccess.hidden) {
            contactForm.reset();
            contactForm.hidden = false;
            contactSuccess.hidden = true;
        }
    });
    contactForm.addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(contactForm);
        const payload = Object.fromEntries(formData.entries());
        const submitButton = contactForm.querySelector('.contact-submit');

        if (String(payload.website).trim()) return;
        submitButton.disabled = true;
        contactForm.dataset.submitting = 'true';
        contactForm.setAttribute('aria-busy', 'true');
        contactForm.querySelector('.contact-spinner').hidden = false;
        contactForm.querySelector('.contact-submit-label').textContent = 'Enviando…';
        contactStatus.textContent = 'Enviando tu mensaje…';
        contactStatus.style.color = 'var(--text-muted)';

        try {
            const response = await fetch(portfolioConfig.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload),
                cache: 'no-store'
            });
            if (!response.ok) {
                throw new Error(`El servidor respondió con estado ${response.status}.`);
            }

            let result;
            try {
                result = JSON.parse(await response.text());
            } catch (error) {
                throw new Error('El servidor no devolvió una respuesta válida.');
            }
            if (result?.success !== true) {
                throw new Error(result?.error || 'No se pudo enviar tu mensaje. Inténtalo de nuevo.');
            }

            contactStatus.textContent = '';
            contactForm.hidden = true;
            contactSuccess.hidden = false;
            contactSuccess.querySelector('h2').focus();
        } catch (error) {
            console.error('No se pudo enviar el mensaje de contacto:', error);
            contactStatus.textContent = error.message || 'No fue posible enviar el mensaje. Inténtalo de nuevo.';
            contactStatus.style.color = '';
        } finally {
            submitButton.disabled = false;
            contactForm.removeAttribute('aria-busy');
            delete contactForm.dataset.submitting;
            contactForm.querySelector('.contact-spinner').hidden = true;
            contactForm.querySelector('.contact-submit-label').textContent = 'Enviar mensaje';
        }
    });

    mediaLightbox.querySelector('.lightbox-close').addEventListener('click', () => mediaLightbox.close());
    lightboxPrevious.addEventListener('click', () => navigateLightbox(-1));
    lightboxNext.addEventListener('click', () => navigateLightbox(1));
    document.addEventListener('keydown', event => {
        if (!mediaLightbox.open || lightboxImages.length < 2) return;
        if (event.key === 'ArrowLeft') navigateLightbox(-1);
        if (event.key === 'ArrowRight') navigateLightbox(1);
    });
    mediaLightbox.addEventListener('click', event => {
        if (event.target === mediaLightbox) mediaLightbox.close();
    });
    mediaLightbox.addEventListener('close', () => {
        mediaLightboxBody.replaceChildren();
        lightboxImages = [];
        lightboxPrevious.hidden = true;
        lightboxNext.hidden = true;
        window.dispatchEvent(new Event('lightbox:close'));
    });

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            if (item.classList.contains('external-link')) {
                window.open(item.dataset.url, '_blank', 'noopener');
                return;
            }

            const targetView = document.getElementById(item.dataset.target);
            mainMenu.classList.remove('active-view');
            setTimeout(() => targetView.classList.add('active-view'), 300);
        });
    });

    backBtns.forEach(btn => {
        btn.addEventListener('click', event => {
            const currentView = event.target.closest('.view-panel');
            currentView.classList.remove('active-view');
            setTimeout(() => mainMenu.classList.add('active-view'), 300);
        });
    });

    function setSyncStatus(message, state = '') {
        syncStatus.textContent = message;
        syncStatus.dataset.state = state;
    }

    function renderPlaceholder(message) {
        contentViewer.replaceChildren();
        const placeholder = document.createElement('div');
        placeholder.className = 'viewer-placeholder';
        const text = document.createElement('p');
        text.textContent = message;
        placeholder.append(text);
        contentViewer.append(placeholder);
    }

    function readCache() {
        try {
            const cached = localStorage.getItem(portfolioConfig.storageKey);
            if (!cached) return null;

            const parsed = JSON.parse(cached);
            if (!parsed || typeof parsed.timestamp !== 'string' || !Array.isArray(parsed.proyectos)) {
                throw new Error('El formato guardado no es válido.');
            }

            return parsed;
        } catch (error) {
            console.error('No se pudo leer la caché de proyectos:', error);
            setSyncStatus('No se pudieron leer los proyectos guardados. Intentando cargar desde el servidor.', 'error');
            return null;
        }
    }

    function normalizeProject(project) {
        if (!project || typeof project !== 'object') return null;

        const id = project.ID ?? project.id;
        const title = project.Proyecto ?? project.title;
        if (id == null || title == null) return null;

        const multimedia = project.Multimedia ?? project.media ?? [];
        const media = Array.isArray(multimedia)
            ? multimedia
            : String(multimedia).split(',');

        return {
            id: String(id).trim(),
            area: String(project['Área'] ?? project.area ?? 'Otros').trim() || 'Otros',
            projectType: String(project.TipoProyecto ?? project.projectType ?? '').trim(),
            title: String(title).trim(),
            description: String(project['Descripción'] ?? project.description ?? '').trim(),
            media: media.map(item => {
                const reference = String(item).trim();
                return reference.replace(/^link\s*:\s*/i, '').trim();
            }).filter(item => item && !/^(youtube\d*|video_youtube)$/i.test(item)),
            mediaType: String(project.TipoMultimedia ?? project.mediaType ?? '').trim(),
            presentation: String(project.Presentación ?? project.presentation ?? '').trim()
        };
    }

    function isDeleted(value) {
        if (value === true || value === 1) return true;
        return typeof value === 'string' && !['', 'false', '0', 'no'].includes(value.trim().toLowerCase());
    }

    function renderCategories() {
        categoriesContainer.replaceChildren();
        const categories = new Map();
        projects.forEach(project => {
            if (!categories.has(project.area)) categories.set(project.area, []);
            categories.get(project.area).push(project);
        });

        if (!projects.length) {
            renderPlaceholder('Todavía no hay proyectos publicados.');
            return;
        }

        Array.from(categories.entries()).forEach(([name, categoryProjects], categoryIndex) => {
            const group = document.createElement('section');
            group.className = 'category-group';

            const header = document.createElement('button');
            header.className = 'category-header';
            header.type = 'button';
            header.setAttribute('aria-expanded', 'false');
            const label = document.createElement('span');
            label.className = 'category-label';
            label.textContent = `[ ${String(categoryIndex + 1).padStart(2, '0')} / ${name.toUpperCase()} ]`;
            header.append(label);

            const list = document.createElement('ul');
            list.className = 'project-list';
            categoryProjects.forEach(project => {
                const item = document.createElement('li');
                const button = document.createElement('button');
                button.className = 'project-item';
                button.type = 'button';
                button.dataset.projectId = project.id;
                button.textContent = project.title;
                button.dataset.techLabel = `[ ${(project.projectType || project.area).toUpperCase()} ]`;
                if (project.id === selectedProjectId) {
                    button.classList.add('active');
                    group.classList.add('active');
                    header.setAttribute('aria-expanded', 'true');
                }
                item.append(button);
                list.append(item);
            });

            header.addEventListener('click', () => {
                const willOpen = !group.classList.contains('active');
                categoriesContainer.querySelectorAll('.category-group').forEach(otherGroup => {
                    otherGroup.classList.remove('active');
                    otherGroup.querySelector('.category-header').setAttribute('aria-expanded', 'false');
                });
                group.classList.toggle('active', willOpen);
                header.setAttribute('aria-expanded', String(willOpen));
            });

            group.append(header, list);
            categoriesContainer.append(group);
        });

        if (!projects.some(project => project.id === selectedProjectId)) {
            selectedProjectId = null;
            renderPlaceholder('Selecciona un proyecto del menú para explorar');
        }
    }

    function replaceProjects(incoming) {
        const snapshot = new Map();
        incoming.forEach(rawProject => {
            const id = rawProject?.ID ?? rawProject?.id;
            if (id == null) {
                console.warn('Se ignoró un proyecto de la respuesta porque no tiene ID.', rawProject);
                return;
            }
            if (isDeleted(rawProject.deleted ?? rawProject.deleted_at)) {
                return;
            }

            const project = normalizeProject(rawProject);
            if (!project) {
                console.warn(`Se ignoró el proyecto ${id} porque sus datos están incompletos.`, rawProject);
                return;
            }
            snapshot.set(project.id, project);
        });
        projects = Array.from(snapshot.values());
    }

    function saveCache(timestamp) {
        try {
            localStorage.setItem(portfolioConfig.storageKey, JSON.stringify({
                timestamp,
                proyectos: projects
            }));
            return true;
        } catch (error) {
            console.error('No se pudo guardar la caché de proyectos:', error);
            setSyncStatus('Los proyectos están actualizados, pero no se pudieron guardar para la próxima visita.', 'error');
            return false;
        }
    }

    async function synchronize() {
        if (syncPromise) return syncPromise;

        syncPromise = (async () => {
            const url = new URL(portfolioConfig.apiUrl);
            const controller = new AbortController();
            const timeout = window.setTimeout(() => controller.abort(), 15000);
            try {
                const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
                if (!response.ok) throw new Error(`El servidor respondió con estado ${response.status}.`);

                const data = await response.json();
                if (data.success === false) throw new Error(data.message || 'El endpoint no pudo entregar los proyectos.');
                if (!Array.isArray(data.proyectos) || typeof data.timestamp !== 'string') {
                    throw new Error('La respuesta del endpoint no tiene el formato esperado.');
                }

                const previousSelectedProject = projects.find(project => project.id === selectedProjectId);
                const previousSelectedSnapshot = previousSelectedProject
                    ? JSON.stringify(previousSelectedProject)
                    : null;
                replaceProjects(data.proyectos);
                const saved = saveCache(data.timestamp);
                renderCategories();
                const selectedProject = projects.find(project => project.id === selectedProjectId);
                if (selectedProject && JSON.stringify(selectedProject) !== previousSelectedSnapshot) {
                    renderProjectContent(selectedProject);
                }

                const syncedAt = new Date(data.timestamp);
                if (saved) {
                    setSyncStatus(
                        `Sincronizado${Number.isNaN(syncedAt.getTime()) ? '' : ` · ${syncedAt.toLocaleString('es-CO')}`}`,
                        'success'
                    );
                }
            } finally {
                window.clearTimeout(timeout);
            }
        })();

        try {
            await syncPromise;
        } finally {
            syncPromise = null;
            lastSyncAt = Date.now();
        }
    }

    categoriesContainer.addEventListener('click', event => {
        const button = event.target.closest('[data-project-id]');
        if (!button) return;

        selectedProjectId = button.dataset.projectId;
        const project = projects.find(item => item.id === selectedProjectId);
        if (!project) return;

        renderCategories();
        renderProjectContent(project);
    });

    const cached = readCache();
    if (cached) {
        projects = cached.proyectos.map(normalizeProject).filter(Boolean);
        renderCategories();
        setSyncStatus('Mostrando proyectos guardados · verificando cambios…', 'loading');
    } else {
        renderPlaceholder('Cargando proyectos…');
        setSyncStatus('Conectando con el portafolio…', 'loading');
    }

    function refreshProjects() {
        synchronize().catch(error => {
            console.error('No se pudieron sincronizar los proyectos:', error);
            const detail = error.name === 'AbortError'
                ? 'La conexión tardó demasiado.'
                : 'No fue posible conectar con el servidor.';

            if (projects.length) {
                setSyncStatus(`${detail} Se muestran los proyectos guardados.`, 'error');
            } else {
                setSyncStatus(detail, 'error');
                renderPlaceholder('No se pudieron cargar los proyectos. Intenta recargar la página.');
            }
        });
    }

    refreshProjects();
    window.setInterval(() => {
        if (document.visibilityState === 'visible' && Date.now() - lastSyncAt >= refreshInterval) {
            refreshProjects();
        }
    }, refreshInterval);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && Date.now() - lastSyncAt >= refreshInterval) {
            refreshProjects();
        }
    });

    function makeElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text) element.textContent = text;
        return element;
    }

    function addTechnicalBadge(card, project) {
        const badgeText = project.projectType || project.area;
        if (!badgeText) return;

        card.dataset.category = project.area;
        const badge = makeElement('span', 'technical-badge', `[ ${badgeText.toUpperCase()} ]`);
        card.append(badge);
    }

    function setPlayingState(audio, isPlaying) {
        const card = audio.closest('.media-card');
        if (card) card.classList.toggle('is-playing', isPlaying);
        const trigger = card?.querySelector('.audio-image-trigger');
        if (trigger) {
            const hint = trigger.querySelector('.audio-image-hint');
            hint.textContent = isPlaying ? '⏸ Pausar audio' : '▶ Escuchar audio';
            trigger.setAttribute(
                'aria-label',
                `${isPlaying ? 'Pausar' : 'Reproducir'} audio asociado a ${card.dataset.mediaReference || 'la imagen'}`
            );
        }
    }

    function addEqualizer(card, trigger) {
        const equalizer = makeElement('span', 'equalizer-bars');
        equalizer.setAttribute('aria-hidden', 'true');
        equalizer.append(
            makeElement('i'),
            makeElement('i'),
            makeElement('i')
        );
        trigger.append(equalizer);
    }

    function registerGlobalAudio(audio) {
        audio.addEventListener('play', () => {
            document.querySelectorAll('audio').forEach(otherAudio => {
                if (otherAudio !== audio) otherAudio.pause();
            });
            setPlayingState(audio, true);
        });
        audio.addEventListener('pause', () => {
            setPlayingState(audio, false);
        });
        audio.addEventListener('ended', () => {
            setPlayingState(audio, false);
        });
        audio.addEventListener('error', () => setPlayingState(audio, false));
    }

    function youtubeVideoId(reference) {
        if (!/^https?:\/\//i.test(reference) || !/youtube\.com|youtu\.be/i.test(reference)) return null;

        if (reference.includes('youtu.be/')) {
            return reference.split('youtu.be/')[1].split(/[?&]/)[0];
        }

        return new URL(reference).searchParams.get('v');
    }

    function openVideoLightbox(videoId, title) {
        const iframe = document.createElement('iframe');
        iframe.className = 'lightbox-video';
        iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1`;
        iframe.title = title;
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;
        openMediaLightbox(iframe, title);
    }

    function openLocalVideoLightbox(src, title) {
        const video = document.createElement('video');
        video.className = 'lightbox-video';
        video.src = src;
        video.controls = true;
        video.autoplay = true;
        video.playsInline = true;
        openMediaLightbox(video, title);
    }

    function renderMedia(reference, project, { pairedAudio = null, pairedAudioSource = null } = {}) {
        const mediaType = reference.split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
        const isAudio = ['m4a', 'mp3', 'wav', 'ogg'].includes(mediaType);
        const isVideo = ['mp4', 'webm', 'mov'].includes(mediaType);
        const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(mediaType);
        const isRemote = /^https?:\/\//i.test(reference);
        const frame = makeElement('figure', 'media-card');

        const videoId = youtubeVideoId(reference);
        if (videoId) {
            const thumbnailButton = makeElement('button', 'video-thumbnail');
            thumbnailButton.type = 'button';
            thumbnailButton.setAttribute('aria-label', `Reproducir video: ${project.title}`);
            const thumbnail = document.createElement('img');
            thumbnail.src = `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
            thumbnail.alt = '';
            thumbnail.loading = 'lazy';
            thumbnailButton.append(
                thumbnail,
                makeElement('span', 'video-play-icon', '▶'),
                makeElement('span', 'video-thumbnail-title', 'VER VIDEO')
            );
            thumbnailButton.addEventListener('click', () => openVideoLightbox(videoId, project.title));
            frame.append(thumbnailButton);
            addTechnicalBadge(frame, project);
            return frame;
        }

        const isRemoteAudio = isRemote && /\.(m4a|mp3|wav|ogg)(?:[?#]|$)/i.test(reference);
        if (pairedAudio) {
            frame.dataset.imageGalleryItem = 'true';
            const image = document.createElement('img');
            image.alt = `${project.title} · Haz clic para escuchar`;
            image.loading = 'lazy';
            const imageSources = resourceCandidates(reference, 'image');
            let sourceIndex = 0;
            image.addEventListener('error', () => {
                sourceIndex += 1;
                if (sourceIndex < imageSources.length) {
                    image.src = imageSources[sourceIndex];
                } else {
                    frame.replaceChildren(makeElement('figcaption', 'media-unavailable', `No se encontró el archivo “${reference}” en resources.`));
                }
            });
            image.src = imageSources[0] || reference;

            const imageButton = document.createElement('button');
            imageButton.className = 'audio-image-trigger';
            imageButton.type = 'button';
            imageButton.setAttribute('aria-label', `Reproducir audio asociado a ${reference}`);
            frame.dataset.mediaReference = reference;
            imageButton.append(image, makeElement('span', 'audio-image-hint', '▶ Escuchar audio'));

            const zoomButton = document.createElement('button');
            zoomButton.className = 'image-zoom-button';
            zoomButton.type = 'button';
            zoomButton.textContent = 'Ampliar imagen';
            zoomButton.addEventListener('click', () => {
                const gallery = frame.closest('.media-gallery');
                const galleryImages = Array.from(gallery.querySelectorAll('[data-image-gallery-item="true"] img'));
                openImageLightbox(
                    galleryImages.map(galleryImage => ({
                        src: galleryImage.currentSrc || galleryImage.src,
                        title: project.title
                    })),
                    galleryImages.indexOf(image)
                );
            });

            const audio = document.createElement('audio');
            audio.className = 'paired-audio';
            audio.controls = true;
            audio.preload = 'none';
            const hint = imageButton.querySelector('.audio-image-hint');
            registerGlobalAudio(audio);
            addEqualizer(frame, imageButton);
            const audioPlayer = configureAudioSources(
                audio,
                pairedAudioSource ? [pairedAudioSource, pairedAudio] : [pairedAudio],
                () => {
                    hint.textContent = 'Audio no disponible';
                    imageButton.setAttribute('aria-label', `Audio no disponible para ${reference}`);
                }
            );
            imageButton.addEventListener('click', async () => {
                if (audio.paused) {
                    contentViewer.querySelectorAll('.paired-audio').forEach(otherAudio => {
                        if (otherAudio !== audio) otherAudio.pause();
                    });
                    try {
                        await audioPlayer.play();
                        hint.textContent = '⏸ Pausar audio';
                        imageButton.setAttribute('aria-label', `Pausar audio asociado a ${reference}`);
                    } catch (error) {
                        console.error('No se pudo reproducir el audio del proyecto:', error);
                        hint.textContent = 'No se pudo reproducir';
                    }
                } else {
                    audio.pause();
                }
            });
            audio.addEventListener('pause', () => {
                hint.textContent = '▶ Escuchar audio';
                imageButton.setAttribute('aria-label', `Reproducir audio asociado a ${reference}`);
            });
            audio.addEventListener('ended', () => {
                hint.textContent = '▶ Escuchar audio';
                imageButton.setAttribute('aria-label', `Reproducir audio asociado a ${reference}`);
            });

            frame.classList.add('media-audio-pair');
            frame.append(imageButton, zoomButton, audio);
            addTechnicalBadge(frame, project);
            return frame;
        }

        const type = isAudio || isRemoteAudio
            ? 'audio'
            : isVideo || (!mediaType && project.mediaType.toLowerCase() === 'video')
                ? 'video'
                : 'image';
        const sources = resourceCandidates(reference, type);
        if (isAudio || type === 'audio') {
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.preload = 'none';
            registerGlobalAudio(audio);
            registerGlobalAudio(audio);
            configureAudioSources(audio, [reference], error => {
                frame.replaceChildren(
                    makeElement('figcaption', 'media-unavailable', `No se pudo reproducir el audio “${reference}”.`),
                    makeElement('p', 'media-error-detail', error.message || 'El navegador rechazó el formato de audio.')
                );
            });
            frame.append(audio, makeElement('figcaption', '', reference));
            addTechnicalBadge(frame, project);
        } else if (isVideo || type === 'video' || (isRemote && /\.(mp4|webm|mov)(?:[?#]|$)/i.test(reference))) {
            const previewButton = makeElement('button', 'video-thumbnail');
            previewButton.type = 'button';
            previewButton.setAttribute('aria-label', `Reproducir video: ${project.title}`);
            const preview = document.createElement('video');
            preview.src = sources[0] || reference;
            preview.muted = true;
            preview.loop = true;
            preview.playsInline = true;
            preview.preload = 'metadata';
            previewButton.append(
                preview,
                makeElement('span', 'video-play-icon', '▶'),
                makeElement('span', 'video-thumbnail-title', 'VER VIDEO')
            );
            previewButton.addEventListener('click', () => openLocalVideoLightbox(sources[0] || reference, project.title));
            frame.append(previewButton);
            addTechnicalBadge(frame, project);
        } else if (isImage || (isRemote && /\.(png|jpe?g|webp|gif)(?:[?#]|$)/i.test(reference)) || sources.length) {
            frame.dataset.imageGalleryItem = 'true';
            const image = document.createElement('img');
            image.alt = project.title;
            image.loading = 'lazy';
            let sourceIndex = 0;
            image.addEventListener('error', () => {
                sourceIndex += 1;
                if (sourceIndex < sources.length) {
                    image.src = sources[sourceIndex];
                } else {
                    frame.replaceChildren(makeElement('figcaption', 'media-unavailable', `No se encontró el archivo “${reference}” en resources.`));
                }
            });
            image.src = sources[0] || reference;
            const imageButton = document.createElement('button');
            imageButton.className = 'gallery-image-button';
            imageButton.type = 'button';
            imageButton.setAttribute('aria-label', `Ampliar imagen: ${project.title}`);
            imageButton.append(image);
            imageButton.addEventListener('click', () => {
                const gallery = frame.closest('.media-gallery');
                const galleryImages = Array.from(gallery.querySelectorAll('[data-image-gallery-item="true"] img'));
                openImageLightbox(
                    galleryImages.map(galleryImage => ({
                        src: galleryImage.currentSrc || galleryImage.src,
                        title: project.title
                    })),
                    galleryImages.indexOf(image)
                );
            });
            frame.append(imageButton);
            addTechnicalBadge(frame, project);
        } else {
            frame.classList.add('media-unavailable-card');
            frame.append(makeElement('figcaption', 'media-unavailable', `Multimedia pendiente de enlazar: ${reference}`));
        }

        return frame;
    }

    function renderProjectContent(project) {
        contentViewer.replaceChildren();
        const content = makeElement('article', 'viewer-content');
        content.append(makeElement('h2', 'viewer-title', project.title));
        const metadata = [project.area, project.projectType].filter(Boolean).join(' · ');
        if (metadata) content.append(makeElement('p', 'viewer-metadata', metadata));

        if (project.description) {
            const description = makeElement('div', 'viewer-description');
            description.append(makeElement('p', '', project.description));
            content.append(description);
        }

        if (project.media.length) {
            const gallery = makeElement('div', `media-gallery${project.presentation === 'hero-image' ? ' media-gallery-hero' : ''}`);
            for (let index = 0; index < project.media.length; index += 1) {
                const reference = project.media[index];
                const nextReference = project.media[index + 1];
                const isImage = !/^https?:\/\//i.test(reference) &&
                    !/^(youtube\d*|video_youtube)$/i.test(reference) &&
                    !/\.(m4a|mp3|wav|ogg|mp4|webm|mov)$/i.test(reference);
                const nextIsAudio = nextReference && (/^https?:\/\//i.test(nextReference)
                    ? /\.(m4a|mp3|wav|ogg)(?:[?#]|$)/i.test(nextReference)
                    : /\.(m4a|mp3|wav|ogg)$/i.test(nextReference));

                if (isImage && nextIsAudio) {
                    gallery.append(renderMedia(reference, project, {
                        pairedAudio: nextReference,
                        pairedAudioSource: /^https?:\/\//i.test(nextReference)
                            ? nextReference
                            : resourceCandidates(nextReference, 'audio')[0]
                    }));
                    index += 1;
                    continue;
                }

                gallery.append(renderMedia(reference, project));
            }
            content.append(gallery);
        } else {
            content.append(makeElement('p', 'media-unavailable', 'Este proyecto todavía no tiene multimedia asociada.'));
        }

        contentViewer.append(content);
    }
});
