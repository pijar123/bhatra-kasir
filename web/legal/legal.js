document.querySelectorAll('.pname').forEach(e => { e.textContent = CONFIG.PRODUCT; });
document.querySelectorAll('.days').forEach(e => { e.textContent = CONFIG.TRIAL_DAYS; });
document.querySelectorAll('a.wa').forEach(a => { a.href = 'https://wa.me/' + CONFIG.SUPPORT_WA; a.textContent = '+' + CONFIG.SUPPORT_WA; });
document.title += ' · ' + CONFIG.PRODUCT;
