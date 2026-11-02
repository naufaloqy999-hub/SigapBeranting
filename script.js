/* ==================================
   SIGAP BERANTING - DIGITAL FLIPBOOK
   VERSI OPTIMASI HP & FULLSCREEN
================================== */


/* ==================================
   MENGAMBIL ELEMEN HTML
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
   VARIABEL UTAMA
================================== */

let pdfDocument = null;
let pageFlip = null;
let pdfPages = [];

let isLoading = false;
let currentPageNumber = 1;
let flipResizeTimer = null;


/* ==================================
   PENGATURAN PDF
================================== */

const PDF_FILE = "./dokumen.pdf";

const BOOK_WIDTH = 420;
const BOOK_HEIGHT = 594;


/* ==================================
   PENGATURAN PDF.JS
================================== */

if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}


/* ==================================
   TAMBAHAN STYLE FULLSCREEN
================================== */

const fullscreenStyle = document.createElement("style");

fullscreenStyle.textContent = `
    html:fullscreen,
    html:fullscreen body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: #F2F8FF !important;
    }

    .reader.fullscreen-active {
        width: 100%;
        height: 100%;
        min-height: 100dvh;
        overflow-y: auto;
        background: #F2F8FF !important;
    }

    .reader.fullscreen-active .reader-header {
        position: relative;
        top: 0;
        min-height: 55px;
        padding: 8px 3%;
    }

    .reader.fullscreen-active .reader-main {
        width: 100%;
        min-height: auto;
        padding: 10px 0 15px;
    }

    .reader.fullscreen-active .reader-heading {
        margin-bottom: 8px;
    }

    .reader.fullscreen-active .reader-heading h2 {
        margin: 4px 0;
        font-size: 20px;
    }

    .reader.fullscreen-active .reader-heading p {
        font-size: 10px;
    }

    .reader.fullscreen-active .book-area {
        width: 100%;
        height: calc(100dvh - 185px);
        min-height: 250px;
        gap: 0;
        padding: 0;
        margin: 0 auto;
    }

    .reader.fullscreen-active .book-container {
        width: 100%;
        height: 100%;
        max-width: none;
        flex: 1;
        overflow: visible;
    }

    .reader.fullscreen-active #book {
        margin: auto;
    }

    .reader.fullscreen-active .page-arrow {
        flex: 0 0 30px;
        width: 30px;
        height: 45px;
        font-size: 27px;
    }

    .reader.fullscreen-active .page-info {
        width: 75%;
        margin: 8px auto 0;
    }

    .reader.fullscreen-active .page-number {
        margin-bottom: 5px;
        font-size: 10px;
    }

    .reader.fullscreen-active .reader-controls {
        gap: 5px;
        margin-top: 10px;
    }

    .reader.fullscreen-active .control-button {
        padding: 8px 10px;
        font-size: 10px;
    }

    .reader.fullscreen-active .reader-tip,
    .reader.fullscreen-active .reader-footer {
        display: none !important;
    }

    .reader.fullscreen-active .loading-box {
        padding: 25px 10px;
    }

    @media (max-width: 600px) {
        .reader.fullscreen-active .reader-heading {
            display: none;
        }

        .reader.fullscreen-active .book-area {
            height: calc(100dvh - 155px);
        }

        .reader.fullscreen-active .page-arrow {
            flex-basis: 22px;
            width: 22px;
            border: none;
            background: transparent;
            box-shadow: none;
        }

        .reader.fullscreen-active .reader-controls {
            padding: 0 4px;
        }

        .reader.fullscreen-active .control-button {
            padding: 8px 7px;
            font-size: 9px;
        }
    }
`;

document.head.appendChild(fullscreenStyle);


/* ==================================
   BUKA PEMBACA
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

backHomeButton.addEventListener("click", async () => {

    if (document.fullscreenElement) {
        await document.exitFullscreen();
    }

    reader.classList.remove("fullscreen-active");
    reader.classList.add("hidden");

    landing.classList.remove("hidden");

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

});


/* ==================================
   STATUS LOADING
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
   MEMUAT PDF
================================== */

async function loadBook() {

    if (isLoading) return;

    isLoading = true;

    showLoading("Menghubungkan ke dokumen PDF...");

    try {

        if (!window.pdfjsLib) {
            throw new Error(
                "PDF.js belum berhasil dimuat. Periksa koneksi internet."
            );
        }

        if (!window.St || typeof window.St.PageFlip !== "function") {
            throw new Error(
                "Pustaka flipbook belum termuat. Periksa koneksi internet."
            );
        }

        // Mengambil dokumen PDF.
        const loadingTask = pdfjsLib.getDocument({
            url: PDF_FILE
        });

        pdfDocument = await loadingTask.promise;

        const totalPages = pdfDocument.numPages;

        totalPagesElement.textContent = totalPages;

        bookElement.innerHTML = "";
        pdfPages = [];


        /* ==========================
           RENDER HALAMAN PDF
        ========================== */

        for (
            let pageNumber = 1;
            pageNumber <= totalPages;
            pageNumber++
        ) {

            loadingText.textContent =
                `Menyiapkan halaman ${pageNumber} dari ${totalPages}...`;

            const pdfPage =
                await pdfDocument.getPage(pageNumber);

            const originalViewport =
                pdfPage.getViewport({ scale: 1 });


            /*
             * Optimasi resolusi:
             * HP menggunakan resolusi lebih ringan.
             * Desktop tetap cukup tajam.
             */

            const isMobile = window.innerWidth <= 600;

            const renderQuality = isMobile ? 1.15 : 1.45;

            const renderScale = Math.min(
                (BOOK_WIDTH * renderQuality) / originalViewport.width,
                (BOOK_HEIGHT * renderQuality) / originalViewport.height
            );

            const viewport =
                pdfPage.getViewport({ scale: renderScale });


            const canvas = document.createElement("canvas");

            const context = canvas.getContext("2d", {
                alpha: false
            });

            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);

            canvas.setAttribute(
                "aria-label",
                `Halaman PDF ${pageNumber}`
            );

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


            const pageElement = document.createElement("div");

            pageElement.className = "page";
            pageElement.dataset.density = "soft";

            pageElement.appendChild(canvas);

            bookElement.appendChild(pageElement);

            pdfPages.push(pageElement);

            // Bersihkan data halaman yang sudah selesai dirender.
            pdfPage.cleanup();


            // Beri kesempatan browser memproses tampilan.
            if (pageNumber % 3 === 0) {
                await new Promise(resolve => {
                    requestAnimationFrame(resolve);
                });
            }

        }


        /* ==========================
           MEMBUAT FLIPBOOK
        ========================== */

        loadingText.textContent =
            "Menyusun halaman menjadi buku digital...";

        await new Promise(resolve => setTimeout(resolve, 100));

        createFlipBook();

        loading.classList.add("hidden");

        bookArea.classList.remove("hidden");
        pageInfo.classList.remove("hidden");
        readerControls.classList.remove("hidden");

        updatePageInfo(0);

    } catch (error) {

        console.error("Gagal memuat buku:", error);

        let message =
            "Buku belum berhasil dibuka. Periksa file dokumen.pdf dan koneksi internet.";

        if (error && error.message) {
            message = error.message;
        }

        showError(message);

    } finally {

        isLoading = false;

    }

}


/* ==================================
   MEMBUAT FLIPBOOK
================================== */

function createFlipBook() {

    if (pageFlip) {

        try {
            pageFlip.destroy();
        } catch (error) {
            console.warn("Flipbook sebelumnya tidak aktif.");
        }

        pageFlip = null;

    }


    pageFlip = new St.PageFlip(
        bookElement,
        {
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
        }
    );


    pageFlip.loadFromHTML(pdfPages);


    pageFlip.on("flip", event => {
        updatePageInfo(event.data);
    });


    updatePageInfo(0);

}


/* ==================================
   INFORMASI HALAMAN
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
   NAVIGASI HALAMAN
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


/* ==================================
   EVENT TOMBOL NAVIGASI
================================== */

prevButton.addEventListener("click", goToPreviousPage);
nextButton.addEventListener("click", goToNextPage);

prevButtonBottom.addEventListener("click", goToPreviousPage);
nextButtonBottom.addEventListener("click", goToNextPage);

firstButton.addEventListener("click", goToFirstPage);
lastButton.addEventListener("click", goToLastPage);


/* ==================================
   MODE LAYAR PENUH
================================== */

fullscreenButton.addEventListener("click", async () => {

    try {

        if (!document.fullscreenElement) {

            // Fullscreen seluruh halaman, bukan hanya kotak reader.
            await document.documentElement.requestFullscreen();

        } else {

            await document.exitFullscreen();

        }

    } catch (error) {

        console.warn("Fullscreen tidak tersedia:", error);

    }

});


/* ==================================
   DETEKSI PERUBAHAN FULLSCREEN
================================== */

document.addEventListener("fullscreenchange", () => {

    const isFullscreen = Boolean(document.fullscreenElement);

    reader.classList.toggle(
        "fullscreen-active",
        isFullscreen
    );

    document.body.style.backgroundColor =
        isFullscreen ? "#F2F8FF" : "";

    document.documentElement.style.backgroundColor =
        isFullscreen ? "#F2F8FF" : "";


    // Beri waktu browser menyesuaikan ukuran layar.
    setTimeout(() => {

        window.dispatchEvent(new Event("resize"));

    }, 250);

});


/* ==================================
   TOMBOL COBA LAGI
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
    pdfPages = [];

    bookElement.innerHTML = "";

    await loadBook();

});


/* ==================================
   PENYESUAIAN UKURAN LAYAR
================================== */

window.addEventListener("resize", () => {

    clearTimeout(flipResizeTimer);

    flipResizeTimer = setTimeout(() => {

        if (!pageFlip || !pdfDocument) return;

        // PageFlip menyesuaikan ukuran secara otomatis.

    }, 250);

});


/* ==================================
   SELESAI
================================== */

console.log("SIGAP BERANTING Digital Flipbook siap dijalankan.");
