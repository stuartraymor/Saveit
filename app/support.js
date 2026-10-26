// Help destinations open only after an explicit click. Reports remain drafts.
(() => {
  const dialog = document.getElementById('bugDialog109');
  const open = url => window.open(url, '_blank', 'noopener,noreferrer');
  document.getElementById('learnLink109').onclick = () => open('https://stuartraymor.github.io/Saveit/learn.html');
  document.getElementById('bugLink109').onclick = () => dialog.showModal();
  document.getElementById('bugCancel109').onclick = () => dialog.close();
  document.getElementById('bugOpen109').onclick = async () => {
    const button = document.getElementById('bugOpen109');
    button.disabled = true;
    try {
      let version = 'Unknown';
      try { version = (await window.bench?.appVersion?.()) || version; } catch (_) { }
      const url = new URL('https://github.com/stuartraymor/Saveit/issues/new');
      url.searchParams.set('title', 'Bug: ');
      url.searchParams.set('body', `### What happened?\nDescribe the problem.\n\n### Steps to reproduce\n1. \n2. \n3. \n\n### Expected result\nWhat should have happened?\n\n### App information\nSave It: ${version}\nPlatform: Windows\n\n### Screenshots (optional)\nRemove private information before attaching files.\n`);
      open(url.href);
      dialog.close();
    } finally { button.disabled = false; }
  };
})();
