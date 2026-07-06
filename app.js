const config = window.EVENT_APP_CONFIG || {};
const hasSupabaseConfig = Boolean(
    config.supabaseUrl &&
    config.supabaseAnonKey &&
    !config.supabaseUrl.includes("YOUR_") &&
    !config.supabaseAnonKey.includes("YOUR_")
);

const state = {
    client: null,
    file: null,
    photos: [],
    adminCode: "",
    filter: "all",
    channel: null
};

const els = {
    setupAlert: document.getElementById("setupAlert"),
    modeTabs: document.querySelectorAll(".mode-tab"),
    views: document.querySelectorAll(".view"),
    uploadForm: document.getElementById("uploadForm"),
    photoInput: document.getElementById("photoInput"),
    dropzone: document.getElementById("dropzone"),
    dropzoneText: document.getElementById("dropzoneText"),
    previewImage: document.getElementById("previewImage"),
    uploaderName: document.getElementById("uploaderName"),
    message: document.getElementById("message"),
    submitBtn: document.getElementById("submitBtn"),
    adminLogin: document.getElementById("adminLogin"),
    adminCode: document.getElementById("adminCode"),
    dashboard: document.getElementById("dashboard"),
    gallery: document.getElementById("gallery"),
    refreshBtn: document.getElementById("refreshBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    filters: document.getElementById("filters"),
    totalCount: document.getElementById("totalCount"),
    winnerCount: document.getElementById("winnerCount"),
    unratedCount: document.getElementById("unratedCount"),
    fiveStarCount: document.getElementById("fiveStarCount"),
    toast: document.getElementById("toast")
};

if (hasSupabaseConfig) {
    state.client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
} else {
    els.setupAlert.hidden = false;
    els.submitBtn.disabled = true;
}

function showToast(message, type = "success") {
    els.toast.textContent = message;
    els.toast.className = `toast ${type}`;
    els.toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
        els.toast.hidden = true;
    }, 3600);
}

function setBusy(button, busy, label) {
    button.disabled = busy;
    if (busy) {
        button.dataset.originalText = button.textContent;
        button.textContent = label;
    } else if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
    }
}

function switchView(viewId) {
    els.modeTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewId));
    els.views.forEach((view) => view.classList.toggle("active", view.id === viewId));
}

function extFromFile(file) {
    const name = file.name || "";
    const dot = name.lastIndexOf(".");
    return dot === -1 ? "jpg" : name.slice(dot + 1).toLowerCase();
}

function makeId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function publicUrl(path) {
    const { data } = state.client.storage.from(config.bucketName).getPublicUrl(path);
    return data.publicUrl;
}

function validImage(file) {
    const ext = extFromFile(file);
    const allowedExt = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"];
    return (file.type && file.type.startsWith("image/")) || allowedExt.includes(ext);
}

function contentTypeFromFile(file) {
    if (file.type) return file.type;

    const ext = extFromFile(file);
    if (ext === "heic") return "image/heic";
    if (ext === "heif") return "image/heif";
    if (ext === "jpg") return "image/jpeg";
    return `image/${ext}`;
}

els.modeTabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
});

els.dropzone.addEventListener("click", () => els.photoInput.click());

els.photoInput.addEventListener("change", () => {
    const file = els.photoInput.files[0];
    if (!file) return;

    if (!validImage(file)) {
        showToast("지원하지 않는 이미지 형식입니다.", "error");
        els.photoInput.value = "";
        return;
    }

    if (file.size > config.maxUploadBytes) {
        showToast("사진 용량이 너무 큽니다. 12MB 이하로 선택해 주세요.", "error");
        els.photoInput.value = "";
        return;
    }

    state.file = file;

    if (file.type.startsWith("image/")) {
        els.previewImage.src = URL.createObjectURL(file);
        els.previewImage.hidden = false;
        els.dropzoneText.hidden = true;
    } else {
        els.previewImage.hidden = true;
        els.dropzoneText.hidden = false;
        els.dropzoneText.querySelector("strong").textContent = file.name;
    }
});

els.uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!state.client) {
        showToast("Supabase 설정이 필요합니다.", "error");
        return;
    }

    if (!state.file) {
        showToast("사진을 선택해 주세요.", "error");
        return;
    }

    const uploaderName = els.uploaderName.value.trim();
    if (!uploaderName) {
        showToast("닉네임을 입력해 주세요.", "error");
        return;
    }

    setBusy(els.submitBtn, true, "전송 중...");

    try {
        const ext = extFromFile(state.file);
        const filePath = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${makeId()}.${ext}`;

        const uploadResult = await state.client.storage
            .from(config.bucketName)
            .upload(filePath, state.file, {
                cacheControl: "3600",
                upsert: false,
                contentType: contentTypeFromFile(state.file)
            });

        if (uploadResult.error) throw uploadResult.error;

        const insertResult = await state.client.from(config.tableName).insert({
            uploader_name: uploaderName,
            message: els.message.value.trim(),
            file_path: filePath,
            original_filename: state.file.name
        });

        if (insertResult.error) throw insertResult.error;

        els.uploadForm.reset();
        state.file = null;
        els.previewImage.hidden = true;
        els.previewImage.removeAttribute("src");
        els.dropzoneText.hidden = false;
        els.dropzoneText.querySelector("strong").textContent = "사진 선택 또는 촬영";
        showToast("사진이 접수되었습니다.");
    } catch (error) {
        console.error(error);
        showToast("업로드에 실패했습니다. 설정과 네트워크를 확인해 주세요.", "error");
    } finally {
        setBusy(els.submitBtn, false);
    }
});

els.adminLogin.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!state.client) {
        showToast("Supabase 설정이 필요합니다.", "error");
        return;
    }

    const code = els.adminCode.value.trim();
    if (!code) return;

    const submitButton = els.adminLogin.querySelector("button");
    setBusy(submitButton, true, "확인 중...");

    try {
        const { data, error } = await state.client.rpc("verify_photo_event_admin", {
            p_admin_code: code
        });

        if (error || data !== true) {
            throw error || new Error("invalid admin code");
        }

        state.adminCode = code;
        els.adminLogin.hidden = true;
        els.dashboard.hidden = false;
        await loadPhotos();
        subscribeRealtime();
    } catch (error) {
        console.error(error);
        showToast("관리자 코드가 맞지 않습니다.", "error");
    } finally {
        setBusy(submitButton, false);
    }
});

els.refreshBtn.addEventListener("click", () => {
    loadPhotos().catch((error) => {
        console.error(error);
        showToast("새로고침에 실패했습니다.", "error");
    });
});

els.logoutBtn.addEventListener("click", () => {
    state.adminCode = "";
    state.photos = [];
    if (state.channel) {
        state.client.removeChannel(state.channel);
        state.channel = null;
    }
    els.dashboard.hidden = true;
    els.adminLogin.hidden = false;
    els.adminCode.value = "";
});

els.filters.addEventListener("click", (event) => {
    const button = event.target.closest(".filter");
    if (!button) return;

    state.filter = button.dataset.filter;
    document.querySelectorAll(".filter").forEach((item) => item.classList.toggle("active", item === button));
    renderGallery();
});

async function loadPhotos() {
    const { data, error } = await state.client
        .from(config.tableName)
        .select("*")
        .order("is_winner", { ascending: false })
        .order("rating", { ascending: false })
        .order("created_at", { ascending: false });

    if (error) throw error;
    state.photos = data || [];
    renderStats();
    renderGallery();
}

function subscribeRealtime() {
    if (state.channel) return;

    state.channel = state.client
        .channel("photo-event-2026-h1")
        .on("postgres_changes", { event: "*", schema: "public", table: config.tableName }, () => {
            loadPhotos().catch((error) => console.error(error));
        })
        .subscribe();

    window.setInterval(() => {
        if (state.adminCode) {
            loadPhotos().catch((error) => console.error(error));
        }
    }, 15000);
}

function renderStats() {
    const photos = state.photos;
    els.totalCount.textContent = String(photos.length);
    els.winnerCount.textContent = String(photos.filter((photo) => photo.is_winner).length);
    els.unratedCount.textContent = String(photos.filter((photo) => Number(photo.rating) === 0).length);
    els.fiveStarCount.textContent = String(photos.filter((photo) => Number(photo.rating) === 5).length);
}

function filteredPhotos() {
    if (state.filter === "all") return state.photos;
    if (state.filter === "winner") return state.photos.filter((photo) => photo.is_winner);
    return state.photos.filter((photo) => Number(photo.rating) === Number(state.filter));
}

function renderGallery() {
    const photos = filteredPhotos();

    if (photos.length === 0) {
        els.gallery.innerHTML = '<div class="empty-state">표시할 사진이 없습니다.</div>';
        return;
    }

    els.gallery.innerHTML = photos.map((photo) => {
        const rating = Number(photo.rating || 0);
        const url = publicUrl(photo.file_path);
        const stars = [1, 2, 3, 4, 5].map((value) => `
            <button class="star ${rating >= value ? "active" : ""}" type="button" data-action="rating" data-id="${photo.id}" data-rating="${value}" aria-label="${value}점">★</button>
        `).join("");

        return `
            <article class="photo-card ${photo.is_winner ? "winner" : ""}">
                <a class="photo-frame" href="${url}" target="_blank" rel="noopener">
                    <img src="${url}" alt="${escapeHtml(photo.uploader_name)} 제출 사진" loading="lazy">
                </a>
                <div class="photo-info">
                    <div class="photo-meta">
                        <div>
                            <strong>${escapeHtml(photo.uploader_name)}</strong>
                            <span>${formatDate(photo.created_at)}</span>
                        </div>
                    </div>
                    <div class="stars">${stars}</div>
                    ${photo.message ? `<div class="message">"${escapeHtml(photo.message)}"</div>` : ""}
                    <div class="card-actions">
                        <button class="winner-btn ${photo.is_winner ? "active" : ""}" type="button" data-action="winner" data-id="${photo.id}">
                            ${photo.is_winner ? "선정됨" : "베스트 샷"}
                        </button>
                        <a href="${url}" download>다운로드</a>
                        <button class="delete-btn" type="button" data-action="delete" data-id="${photo.id}" aria-label="삭제">×</button>
                    </div>
                </div>
            </article>
        `;
    }).join("");
}

els.gallery.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;

    const id = target.dataset.id;
    const photo = state.photos.find((item) => item.id === id);
    if (!photo) return;

    try {
        if (target.dataset.action === "rating") {
            const current = Number(photo.rating || 0);
            const selected = Number(target.dataset.rating);
            await saveReview(id, selected === current ? 0 : selected, Boolean(photo.is_winner));
        }

        if (target.dataset.action === "winner") {
            await saveReview(id, Number(photo.rating || 0), !photo.is_winner);
        }

        if (target.dataset.action === "delete") {
            if (!confirm("이 사진을 삭제하시겠습니까?")) return;
            const { error } = await state.client.rpc("delete_photo_event_submission", {
                p_id: id,
                p_admin_code: state.adminCode
            });
            if (error) throw error;
        }

        await loadPhotos();
    } catch (error) {
        console.error(error);
        showToast("관리 작업에 실패했습니다.", "error");
    }
});

async function saveReview(id, rating, isWinner) {
    const { error } = await state.client.rpc("set_photo_event_review", {
        p_id: id,
        p_rating: rating,
        p_is_winner: isWinner,
        p_admin_code: state.adminCode
    });

    if (error) throw error;
}

function formatDate(value) {
    const date = new Date(value);
    return new Intl.DateTimeFormat("ko-KR", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
