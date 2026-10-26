/* ==================================
   SIGAP BERANTING - DIGITAL FLIPBOOK
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

const prevButtonBottom =
    document.getElementById("prevButtonBottom");

const nextButtonBottom =
    document.getElementById("nextButtonBottom");

const firstButton = document.getElementById("firstButton");
const lastButton = document.getElementById("lastButton");

let pdfDocument = null;
let pageFlip = null;
let pdfPages = [];

let isLoading = false;
let currentPageNumber = 1;
let flipResizeTimer = null;


/* ==================================
   PENGATURAN PDF
================================== */

// File PDF harus satu folder dengan index.html.
const PDF_FILE = "./dokumen.pdf";

// Ukuran dasar buku dalam pixel.
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

backHomeButton.addEventListener("click", () => {
    reader.classList.add("hidden");
    landing.classList.remove("hidden");

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
});


/* ==================================
   PESAN STATUS PEMUATAN
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

        // Pastikan pustaka tersedia.
        if (!window.pdfjsLib) {
            throw new Error(
                "PDF.js belum berhasil dimuat. Periksa koneksi internet."
            );
        }

        if (
            !window.St ||
            typeof window.St.PageFlip !== "function"
        ) {
            throw new Error(
                "Pustaka efek membalik halaman belum termuat. " +
                "Periksa koneksi internet lalu coba lagi."
            );
        }

        // Ambil dokumen PDF.
        const loadingTask = pdfjsLib.getDocument({
            url: PDF_FILE
        });

        pdfDocument = await loadingTask.promise;

        const totalPages = pdfDocument.numPages;

        totalPagesElement.textContent = totalPages;

        // Bersihkan halaman dari proses sebelumnya.
        bookElement.innerHTML = "";
        pdfPages = [];

        /*
         * Setiap halaman PDF dirender menjadi canvas.
         * Canvas lalu dimasukkan ke elemen halaman flipbook.
         */

        for (let pageNumber = 1;
             pageNumber <= totalPages;
             pageNumber++) {

            loadingText.textContent =
                `Menyiapkan halaman ${pageNumber} dari ${totalPages}...`;

            const pdfPage =
                await pdfDocument.getPage(pageNumber);

            const originalViewport =
                pdfPage.getViewport({ scale: 1 });

            // Render dengan resolusi lebih tinggi agar teks jelas.
            const renderScale = Math.min(
                (BOOK_WIDTH * 2) / originalViewport.width,
                (BOOK_HEIGHT * 2) / originalViewport.height
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
        }

        loadingText.textContent =
            "Menyusun halaman menjadi buku digital...";

        // Beri kesempatan browser memperbarui tampilan.
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
            "Buku belum berhasil dibuka. Periksa file dokumen.pdf " +
            "dan pastikan koneksi internet aktif.";

        if (
            error &&
            typeof error.message === "string" &&
            error.message.length > 0
        ) {
            message = error.message;
        }

        showError(message);

    } finally {

        isLoading = false;

    }
}


/* ==================================
   MEMBUAT EFEK FLIPBOOK
================================== */

function createFlipBook() {

    // Hapus instance lama jika ada.
    if (pageFlip) {
        try {
            pageFlip.destroy();
        } catch (error) {
            console.warn(
                "Instance flipbook sebelumnya sudah tidak aktif."
            );
        }

        pageFlip = null;
    }

    /*
     * Gunakan ukuran dasar A4.
     * StPageFlip menyesuaikan tampilan dengan ruang yang tersedia.
     */

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
            flippingTime: 700,

            usePortrait: true,
            startPage: 0,

            autoSize: true,
            maxShadowOpacity: 0.45,

            showCover: false,
            mobileScrollSupport: true,

            clickEventForward: true,
            useMouseEvents: true
        }
    );

    pageFlip.loadFromHTML(pdfPages);

    // Perbarui nomor halaman setiap kali buku dibalik.
    pageFlip.on("flip", event => {
        updatePageInfo(event.data);
    });

    // Perbarui tampilan jika browser selesai mengubah ukuran.
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


// Tombol di samping buku.
prevButton.addEventListener(
    "click",
    goToPreviousPage
);

nextButton.addEventListener(
    "click",
    goToNextPage
);

// Tombol di bawah buku.
prevButtonBottom.addEventListener(
    "click",
    goToPreviousPage
);

nextButtonBottom.addEventListener(
    "click",
    goToNextPage
);

firstButton.addEventListener(
    "click",
    goToFirstPage
);

lastButton.addEventListener(
    "click",
    goToLastPage
);


/* ==================================
   MODE LAYAR PENUH
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
            "Mode layar penuh tidak tersedia di browser ini.",
            error
        );

    }

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
   PENYESUAIAN TAMPILAN
================================== */

window.addEventListener("resize", () => {

    clearTimeout(flipResizeTimer);

    flipResizeTimer = setTimeout(() => {

        if (!pageFlip || !pdfDocument) return;

        /*
         * StPageFlip menangani penyesuaian ukuran secara otomatis.
         * Hindari membuat ulang seluruh buku pada setiap resize.
         */

    }, 200);

});


/* ==================================
   SELESAI
================================== */

console.log("SIGAP BERANTING siap dijalankan.");