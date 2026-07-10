import './style.css';
import { seedMasterListIfEmpty } from './db/seedMasterList.js';

// এই ফাইলটাই অ্যাপের এন্ট্রি পয়েন্ট।
// পরের ফেজে এখান থেকে stock/sales/invoice মডিউল ইম্পোর্ট ও রেন্ডার হবে।

const contentEl = document.getElementById('app-content');

async function init() {
  contentEl.innerHTML = '<p>মেডিসিন লিস্ট লোড হচ্ছে, একটু অপেক্ষা করুন...</p>';
  const result = await seedMasterListIfEmpty();
  contentEl.innerHTML = `<p>প্রস্তুত — মাস্টার লিস্টে ${result.count} টা মেডিসিন আছে।</p>`;
}

init();
