const config = window.EVENT_APP_CONFIG || {};
if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
}
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
    channel: null,
    chart: null
};

const els = {
    homeView: document.getElementById("homeView"),
    uploadView: document.getElementById("uploadView"),
    adminView: document.getElementById("adminView"),
    openUpload: document.getElementById("openUpload"),
    openAdmin: document.getElementById("openAdmin"),
    homeButtons: document.querySelectorAll(".js-home"),
    setupAlert: document.getElementById("setupAlert"),
    uploadForm: document.getElementById("uploadForm"),
    photoInput: document.getElementById("photoInput"),
    uploadBox: document.getElementById("uploadBox"),
    uploadContent: document.getElementById("uploadContent"),
    previewImg: document.getElementById("previewImg"),
    uploaderName: document.getElementById("uploaderName"),
    message: document.getElementById("message"),
    submitBtn: document.getElementById("submitBtn"),
    adminModal: document.getElementById("adminModal"),
    adminPw: document.getElementById("adminPw"),
    adminError: document.getElementById("adminError"),
    closeAdminModal: document.getElementById("closeAdminModal"),
    confirmAdmin: document.getElementById("confirmAdmin"),
    refreshBtn: document.getElementById("refreshBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    filters: document.getElementById("filters"),
    gallery: document.getElementById("gallery"),
    totalCount: document.getElementById("totalCount"),
    ratingCounts: {
        0: document.getElementById("count0"),
        1: document.getElementById("count1"),
        2: document.getElementById("count2"),
        3: document.getElementById("count3"),
        4: document.getElementById("count4"),
        5: document.getElementById("count5")
    }
};

if (hasSupabaseConfig) {
    state.client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
} else {
    els.setupAlert.hidden = false;
    els.submitBtn.disabled = true;
}

function alertPopup(options) {
    if (window.Swal) {
        return window.Swal.fire(options);
    }
    alert(options.text || options.title);
    return Promise.resolve();
}

function showScreen(name) {
    const screens = {
        home: els.homeView,
        upload: els.uploadView,
        admin: els.adminView
    };

    Object.entries(screens).forEach(([key, screen]) => {
        screen.classList.toggle("active", key === name);
    });

    document.body.className = `page-${name}`;
    const targetUrl = `${window.location.pathname}${name === "home" ? "" : `#${name}`}`;
    history.replaceState(null, "", targetUrl);
    window.scrollTo(0, 0);
    setTimeout(() => window.scrollTo(0, 0), 0);
}

function openAdminModal() {
    els.adminError.style.display = "none";
    els.adminModal.classList.add("open");
    setTimeout(() => els.adminPw.focus(), 100);
}

function closeAdminModal() {
    els.adminModal.classList.remove("open");
    els.adminPw.value = "";
    els.adminError.style.display = "none";
}

function setBusy(button, busy, label) {
    button.disabled = busy;
    if (busy) {
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = label;
    } else if (button.dataset.originalText) {
        button.innerHTML = button.dataset.originalText;
    }
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

els.openUpload.addEventListener("click", () => showScreen("upload"));
els.openAdmin.addEventListener("click", openAdminModal);
els.homeButtons.forEach((button) => button.addEventListener("click", () => showScreen("home")));
els.closeAdminModal.addEventListener("click", closeAdminModal);
els.adminModal.addEventListener("click", (event) => {
    if (event.target === els.adminModal) closeAdminModal();
});
els.adminPw.addEventListener("keydown", (event) => {
    if (event.key === "Enter") verifyAdmin();
});
els.confirmAdmin.addEventListener("click", verifyAdmin);
els.uploadBox.addEventListener("click", () => els.photoInput.click());

els.photoInput.addEventListener("change", () => {
    const file = els.photoInput.files[0];
    if (!file) return;

    if (!validImage(file)) {
        alertPopup({
            title: "오류 발생 😢",
            text: "지원하지 않는 이미지 형식입니다.",
            icon: "error",
            confirmButtonColor: "#fb6f92"
        });
        els.photoInput.value = "";
        return;
    }

    if (file.size > config.maxUploadBytes) {
        alertPopup({
            title: "오류 발생 😢",
            text: "사진 용량이 너무 큽니다. 12MB 이하로 선택해 주세요.",
            icon: "error",
            confirmButtonColor: "#fb6f92"
        });
        els.photoInput.value = "";
        return;
    }

    state.file = file;

    if (file.type.startsWith("image/")) {
        els.previewImg.src = URL.createObjectURL(file);
        els.previewImg.hidden = false;
        els.uploadContent.style.opacity = "0";
    } else {
        els.previewImg.hidden = true;
        els.uploadContent.style.opacity = "1";
        els.uploadContent.querySelector("strong").textContent = file.name;
    }
});

els.uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!state.client) {
        await alertPopup({
            title: "설정 필요",
            text: "Supabase 연결 정보를 확인해 주세요.",
            icon: "error",
            confirmButtonColor: "#fb6f92"
        });
        return;
    }

    if (!state.file) {
        await alertPopup({
            title: "사진을 선택해주세요",
            text: "사진을 선택하거나 촬영한 뒤 전송해 주세요.",
            icon: "warning",
            confirmButtonColor: "#fb6f92"
        });
        return;
    }

    const uploaderName = els.uploaderName.value.trim();
    if (!uploaderName) {
        await alertPopup({
            title: "닉네임을 입력해주세요",
            text: "누가 보냈는지 확인할 수 있게 닉네임을 적어 주세요.",
            icon: "warning",
            confirmButtonColor: "#fb6f92"
        });
        return;
    }

    setBusy(els.submitBtn, true, '<i class="fa-solid fa-spinner fa-spin"></i> 전송중...');

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

        resetUploadForm();
        await alertPopup({
            title: "전송 완료! 🎉",
            text: "예쁜 사진 너무 감사합니다! 좋은 결과 기대해주세요🥰",
            icon: "success",
            confirmButtonText: "확인",
            confirmButtonColor: "#fb6f92"
        });
    } catch (error) {
        console.error(error);
        await alertPopup({
            title: "오류 발생 😢",
            text: "업로드 중 문제가 발생했습니다. 다시 시도해주세요.",
            icon: "error",
            confirmButtonColor: "#fb6f92"
        });
    } finally {
        setBusy(els.submitBtn, false);
    }
});

function resetUploadForm() {
    els.uploadForm.reset();
    state.file = null;
    els.previewImg.hidden = true;
    els.previewImg.removeAttribute("src");
    els.uploadContent.style.opacity = "1";
    els.uploadContent.querySelector("strong").textContent = "사진을 선택하거나 촬영해주세요!";
}

async function verifyAdmin() {
    if (!state.client) {
        els.adminError.textContent = "⚠️ Supabase 설정을 확인해 주세요";
        els.adminError.style.display = "block";
        return;
    }

    const code = els.adminPw.value.trim();
    if (!code) return;

    setBusy(els.confirmAdmin, true, "확인 중...");

    try {
        const { data, error } = await state.client.rpc("verify_photo_event_admin", {
            p_admin_code: code
        });

        if (error || data !== true) {
            throw error || new Error("invalid admin code");
        }

        state.adminCode = code;
        closeAdminModal();
        showScreen("admin");
        await loadPhotos();
        subscribeRealtime();
    } catch (error) {
        console.error(error);
        els.adminError.textContent = "⚠️ 비밀번호가 틀렸습니다";
        els.adminError.style.display = "block";
        els.adminPw.value = "";
        els.adminPw.focus();
    } finally {
        setBusy(els.confirmAdmin, false);
    }
}

els.refreshBtn.addEventListener("click", () => {
    loadPhotos().catch((error) => {
        console.error(error);
        alertPopup({
            title: "오류 발생 😢",
            text: "새로고침에 실패했습니다.",
            icon: "error",
            confirmButtonColor: "#8b5cf6"
        });
    });
});

els.logoutBtn.addEventListener("click", () => {
    state.adminCode = "";
    state.photos = [];
    if (state.channel) {
        state.client.removeChannel(state.channel);
        state.channel = null;
    }
    showScreen("home");
});

els.filters.addEventListener("click", (event) => {
    const button = event.target.closest(".filter-tab");
    if (!button) return;

    state.filter = button.dataset.filter;
    document.querySelectorAll(".filter-tab").forEach((item) => item.classList.toggle("active", item === button));
    renderGallery();
});

els.gallery.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();

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
            const result = await confirmPopup("정말 이 사진을 삭제하시겠습니까?");
            if (!result) return;

            const { error } = await state.client.rpc("delete_photo_event_submission", {
                p_id: id,
                p_admin_code: state.adminCode
            });
            if (error) throw error;
        }

        await loadPhotos();
    } catch (error) {
        console.error(error);
        await alertPopup({
            title: "오류 발생 😢",
            text: "관리 작업에 실패했습니다.",
            icon: "error",
            confirmButtonColor: "#8b5cf6"
        });
    }
});

async function confirmPopup(message) {
    if (!window.Swal) return confirm(message);

    const result = await window.Swal.fire({
        title: message,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "삭제",
        cancelButtonText: "취소",
        confirmButtonColor: "#ef4444",
        cancelButtonColor: "#a78bfa"
    });

    return result.isConfirmed;
}

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
    const counts = [0, 0, 0, 0, 0, 0];
    state.photos.forEach((photo) => {
        const rating = Number(photo.rating || 0);
        if (rating >= 0 && rating <= 5) counts[rating] += 1;
    });

    els.totalCount.textContent = String(state.photos.length);
    counts.forEach((count, rating) => {
        els.ratingCounts[rating].textContent = String(count);
    });
    renderChart(counts);
}

function renderChart(counts) {
    const canvas = document.getElementById("ratingChart");
    if (!canvas || !window.Chart) return;

    const data = {
        labels: ["0점", "1점", "2점", "3점", "4점", "5점"],
        datasets: [{
            label: "사진 수",
            data: counts,
            backgroundColor: ["#e2e8f0", "#fca5a5", "#fdba74", "#fcd34d", "#86efac", "#93c5fd"],
            borderRadius: 8
        }]
    };

    if (state.chart) {
        state.chart.data = data;
        state.chart.update();
        return;
    }

    state.chart = new window.Chart(canvas.getContext("2d"), {
        type: "bar",
        data,
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}

function filteredPhotos() {
    if (state.filter === "all") return state.photos;
    return state.photos.filter((photo) => Number(photo.rating) === Number(state.filter));
}

function renderGallery() {
    const photos = filteredPhotos();

    if (photos.length === 0) {
        els.gallery.innerHTML = '<div class="empty-state">아직 접수된 사진이 없습니다.</div>';
        return;
    }

    els.gallery.innerHTML = photos.map((photo) => {
        const rating = Number(photo.rating || 0);
        const url = publicUrl(photo.file_path);
        const stars = [1, 2, 3, 4, 5].map((value) => `
            <button class="fa-solid fa-star admin-star ${rating >= value ? "active" : ""}" type="button" data-action="rating" data-id="${photo.id}" data-rating="${value}" aria-label="${value}점"></button>
        `).join("");

        return `
            <article class="photo-card" data-rating="${rating}">
                <a class="photo-wrapper" href="${url}" target="_blank" rel="noopener">
                    <img src="${url}" alt="${escapeHtml(photo.uploader_name)} 제출 사진" loading="lazy">
                </a>
                <div class="info">
                    <div class="admin-rating" data-id="${photo.id}">
                        ${stars}
                    </div>
                    <div class="uploader-row">
                        <div>
                            <span class="uploader-name">${escapeHtml(photo.uploader_name)}</span>
                            <button class="fa-solid fa-trash delete-btn" type="button" data-action="delete" data-id="${photo.id}" aria-label="삭제"></button>
                        </div>
                        <button class="fa-solid fa-crown crown ${photo.is_winner ? "active" : ""}" type="button" data-action="winner" data-id="${photo.id}" aria-label="베스트 샷"></button>
                    </div>
                    ${photo.message ? `<div class="message">"${escapeHtml(photo.message)}"</div>` : ""}
                    <div class="time">${formatDate(photo.created_at)}</div>
                </div>
            </article>
        `;
    }).join("");
}

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

const initialHash = window.location.hash.replace("#", "");
if (initialHash === "upload") {
    showScreen("upload");
} else if (initialHash === "admin") {
    showScreen("home");
    openAdminModal();
} else {
    showScreen("home");
}
