/* ==================================
   SIGAP BERANTING - OPTIMIZED FLIPBOOK
================================== */

const landing = document.getElementById("landing");
const reader = document.getElementById("reader");

const openBookButton = document.getElementById("openBook");
const backHomeButton = document.getElementById("backHome");
const fullscreenButton = document.getElementById("fullscreenButton");

const loading = document.getElementById("loading");
const loadingText = document.getElementById("loadingText");

const bookArea = document.getElementById("bookArea");
const bookElement = document.getElementById("book");

const pageInfo = document.getElementById("pageInfo");
const readerControls = document.getElementById("readerControls");

const currentPageElement = document.getElementById("currentPage");
const totalPagesElement = document.getElementById("totalPages");
const progressBar = document.getElementById("progressBar");

const errorBox = document.getElementById("errorBox");
const errorMessage = document.getElementById("errorMessage");

const retryButton = document.getElementById("retryButton");

const prevButton = document.getElementById("prevButton");
const nextButton = document.getElementById("nextButton");

const prevButtonBottom = document.getElementById("prevButtonBottom");
const nextButtonBottom = document.getElementById("nextButtonBottom");

const firstButton = document.getElementById("firstButton");
const lastButton = document.getElementById("lastButton");


/* ==================================
   KONFIGURASI
================================== */

const PDF_FILE = "./dokumen.pdf";

const BOOK_WIDTH = 420;
const BOOK_HEIGHT = 594;

// Resolusi dibatasi supaya tidak terlalu berat di HP.
const RENDER_QUALITY = Math.min(
    window.devicePixelRatio || 1,
    1.35
);

// Jumlah halaman yang dirender lebih awal.
const INITIAL_PAGES = 2;

// Jumlah halaman sekitar halaman aktif yang dipersiapkan.
const RENDER_AHEAD = 2;

let pdfDocument = null;
let pageFlip = null;

let pageElements = [];
let renderedPages = new Set();
let renderingPages = new Map();

let isLoading = false;
let currentPageNumber = 1;
let flipResizeTimer = null;


/* ==================================
   PDF.JS WORKER
================================== */

if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}


/* ==================================
   TAMPILAN STATUS
================================== */

function showLoading(message) {
    loading.classList.remove("hidden");
    loadingText.textContent = message;

    bookArea.classList.add("hidden");
    pageInfo.classList.add("hidden");
    readerControls.classList.add("hidden");

    errorBox.classList.add("hidden");
}


function showError(message) {
    loading.classList.add("hidden");
    bookArea.classList.add("hidden");
    pageInfo.classList.add("hidden");
    readerControls.classList.add("hidden");

    errorMessage.textContent = message;
    errorBox.classList.remove("hidden");
}


/* ==================================
   BUKA BUKU
================================== */

openBookButton.addEventListener("click", async () => {
    landing.classList.add("hidden");
    reader.classList.remove("hidden");

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    if (!pageFlip && !isLoading) {
        await loadBook();
    }
});


/* ==================================
   KEMBALI KE BERANDA
================================== */

backHomeButton.addEventListener("click", () => {
    reader.classList.add("hidden");
    landing.classList.remove("hidden");

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
});


/* ==================================
   MEMBUAT KERANGKA HALAMAN
================================== */

function createPageElements(totalPages) {
    bookElement.innerHTML = "";

    pageElements = [];
    renderedPages.clear();
    renderingPages.clear();

    for (let i = 0; i < totalPages; i++) {
        const pageElement = document.createElement("div");

        pageElement.className = "page";
        pageElement.dataset.pageIndex = i;
        pageElement.dataset.density = "soft";

        // Placeholder sebelum isi PDF selesai dirender.
        pageElement.style.backgroundColor = "#ffffff";

        const canvas = document.createElement("canvas");

        canvas.setAttribute(
            "aria-label",
            `Halaman PDF ${i + 1}`
        );

        canvas.style.display = "block";
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.objectFit = "contain";

        pageElement.appendChild(canvas);
        bookElement.appendChild(pageElement);

        pageElements.push(pageElement);
    }
}


/* ==================================
   RENDER SATU HALAMAN PDF
================================== */

async function renderPage(pageIndex) {
    if (
        !pdfDocument ||
        pageIndex < 0 ||
        pageIndex >= pdfDocument.numPages
    ) {
        return;
    }

    if (renderedPages.has(pageIndex)) {
        return;
    }

    // Hindari merender halaman yang sama dua kali.
    if (renderingPages.has(pageIndex)) {
        return renderingPages.get(pageIndex);
    }

    const renderPromise = (async () => {
        const pageNumber = pageIndex + 1;

        const pdfPage = await pdfDocument.getPage(pageNumber);

        const originalViewport = pdfPage.getViewport({
            scale: 1
        });

        // Sesuaikan resolusi dengan ukuran layar.
        const screenScale = Math.min(
            (BOOK_WIDTH * RENDER_QUALITY) /
                originalViewport.width,
            (BOOK_HEIGHT * RENDER_QUALITY) /
                originalViewport.height
        );

        const viewport = pdfPage.getViewport({
            scale: screenScale
        });

        const pageElement = pageElements[pageIndex];

        if (!pageElement) {
            return;
        }

        const canvas = pageElement.querySelector("canvas");

        const context = canvas.getContext("2d", {
            alpha: false
        });

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        context.fillStyle = "#ffffff";

        context.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        await pdfPage.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        renderedPages.add(pageIndex);

        // Lepaskan referensi halaman PDF setelah render.
        pdfPage.cleanup();

    })();

    renderingPages.set(pageIndex, renderPromise);

    try {
        await renderPromise;
    } finally {
        renderingPages.delete(pageIndex);
    }
}


/* ==================================
   RENDER HALAMAN DI SEKITAR HALAMAN AKTIF
================================== */

async function renderNearbyPages(pageIndex) {
    if (!pdfDocument) return;

    const total = pdfDocument.numPages;

    const start = Math.max(
        0,
        pageIndex - RENDER_AHEAD
    );

    const end = Math.min(
        total - 1,
        pageIndex + RENDER_AHEAD
    );

    // Prioritaskan halaman aktif agar cepat terlihat.
    await renderPage(pageIndex);

    // Render halaman sekitar secara bertahap.
    for (let i = start; i <= end; i++) {
        if (i === pageIndex) continue;

        try {
            await renderPage(i);
        } catch (error) {
            console.warn(
                `Gagal merender halaman ${i + 1}:`,
                error
            );
        }
    }
}


/* ==================================
   MEMUAT PDF
================================== */

async function loadBook() {
    if (isLoading) return;

    isLoading = true;

    showLoading("Menghubungkan ke dokumen PDF...");

    try {
        if (!window.pdfjsLib) {
            throw new Error(
                "PDF.js belum termuat. Periksa koneksi internet."
            );
        }

        if (
            !window.St ||
            typeof window.St.PageFlip !== "function"
        ) {
            throw new Error(
                "Library flipbook belum termuat. " +
                "Periksa koneksi internet dan muat ulang website."
            );
        }

        loadingText.textContent = "Membuka dokumen PDF...";

        const loadingTask = pdfjsLib.getDocument({
            url: PDF_FILE
        });

        pdfDocument = await loadingTask.promise;

        const totalPages = pdfDocument.numPages;

        totalPagesElement.textContent = totalPages;

        // Buat kerangka semua halaman tanpa merender semuanya.
        createPageElements(totalPages);

        loadingText.textContent =
            `Menyiapkan halaman 1 dari ${totalPages}...`;

        // Render halaman pertama sebelum menampilkan buku.
        await renderPage(0);

        // Siapkan halaman kedua jika tersedia.
        if (totalPages > 1) {
            loadingText.textContent =
                `Menyiapkan halaman 2 dari ${totalPages}...`;

            await renderPage(1);
        }

        loadingText.textContent = "Menyusun buku digital...";

        createFlipBook();

        loading.classList.add("hidden");
        bookArea.classList.remove("hidden");
        pageInfo.classList.remove("hidden");
        readerControls.classList.remove("hidden");

        updatePageInfo(0);

        // Render halaman lain di belakang layar setelah buku muncul.
        setTimeout(() => {
            renderNearbyPages(0).catch(error => {
                console.warn("Render halaman tambahan:", error);
            });
        }, 100);

    } catch (error) {
        console.error("Gagal memuat buku:", error);

        let message =
            "Buku belum berhasil dibuka. Pastikan dokumen.pdf " +
            beradaDiFolderYangBenar();

        if (error && error.message) {
            message = error.message;
        }

        showError(message);

    } finally {
        isLoading = false;
    }
}


/* ==================================
   PESAN LOKASI PDF
================================== */

function beradaDiFolderYangBenar() {
    return " berada satu folder dengan index.html dan koneksi internet aktif.";
}


/* ==================================
   MEMBUAT FLIPBOOK
================================== */

function createFlipBook() {
    if (pageFlip) {
        try {
            pageFlip.destroy();
        } catch (error) {
            console.warn("Flipbook sebelumnya:", error);
        }

        pageFlip = null;
    }

    pageFlip = new St.PageFlip(bookElement, {
        width: BOOK_WIDTH,
        height: BOOK_HEIGHT,

        size: "stretch",

        minWidth: 260,
        maxWidth: BOOK_WIDTH,

        minHeight: 368,
        maxHeight: BOOK_HEIGHT,

        drawShadow: true,
        flippingTime: 650,

        usePortrait: true,
        startPage: 0,

        autoSize: true,
        maxShadowOpacity: 0.35,

        showCover: false,
        mobileScrollSupport: true,

        clickEventForward: true,
        useMouseEvents: true
    });

    pageFlip.loadFromHTML(pageElements);

    pageFlip.on("flip", event => {
        const pageIndex = Number(event.data);

        updatePageInfo(pageIndex);

        // Render halaman aktif dan halaman di sekitarnya.
        renderNearbyPages(pageIndex).catch(error => {
            console.warn("Gagal memuat halaman:", error);
        });
    });

    updatePageInfo(0);
}


/* ==================================
   NOMOR DAN PROGRES HALAMAN
================================== */

function updatePageInfo(pageIndex) {
    if (!pdfDocument) return;

    const total = pdfDocument.numPages;

    currentPageNumber = Math.max(
        1,
        Math.min(total, Number(pageIndex) + 1)
    );

    currentPageElement.textContent = currentPageNumber;
    totalPagesElement.textContent = total;

    const percentage = total > 0
        ? (currentPageNumber / total) * 100
        : 0;

    progressBar.style.width = `${percentage}%`;
}


/* ==================================
   NAVIGASI
================================== */

function goToPreviousPage() {
    if (pageFlip) {
        pageFlip.flipPrev();
    }
}

function goToNextPage() {
    if (pageFlip) {
        pageFlip.flipNext();
    }
}

function goToFirstPage() {
    if (pageFlip) {
        pageFlip.turnToPage(0);
    }
}

function goToLastPage() {
    if (pageFlip && pdfDocument) {
        pageFlip.turnToPage(pdfDocument.numPages - 1);
    }
}

prevButton.addEventListener("click", goToPreviousPage);
nextButton.addEventListener("click", goToNextPage);

prevButtonBottom.addEventListener("click", goToPreviousPage);
nextButtonBottom.addEventListener("click", goToNextPage);

firstButton.addEventListener("click", goToFirstPage);
lastButton.addEventListener("click", goToLastPage);


/* ==================================
   LAYAR PENUH
================================== */

fullscreenButton.addEventListener("click", async () => {
    try {
        const target = document.getElementById("reader");

        if (!document.fullscreenElement) {
            if (target.requestFullscreen) {
                await target.requestFullscreen();
            }
        } else {
            await document.exitFullscreen();
        }
    } catch (error) {
        console.warn(
            "Mode layar penuh tidak tersedia:",
            error
        );
    }
});


/* ==================================
   COBA LAGI
================================== */

retryButton.addEventListener("click", async () => {
    if (isLoading) return;

    if (pageFlip) {
        try {
            pageFlip.destroy();
        } catch (error) {
            console.warn(error);
        }
    }

    pageFlip = null;
    pdfDocument = null;

    pageElements = [];
    renderedPages.clear();
    renderingPages.clear();

    bookElement.innerHTML = "";

    await loadBook();
});


/* ==================================
   PENYESUAIAN LAYAR
================================== */

window.addEventListener("resize", () => {
    clearTimeout(flipResizeTimer);

    flipResizeTimer = setTimeout(() => {
        if (!pageFlip || !pdfDocument) return;

        // Tidak membuat ulang seluruh flipbook saat layar berubah.
    }, 200);
});


/* ==================================
   SELESAI
================================== */

console.log("SIGAP BERANTING siap dijalankan.");
