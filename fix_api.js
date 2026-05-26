let fs = require('fs');

['public/admin/index.html', 'public/admin/edit.html', 'public/admin/new.html'].forEach(file => {
  let c = fs.readFileSync(file, 'utf8');

  // Remove hardcoded token
  c = c.replace(/var GITHUB_TOKEN = '[^']+';/, "var GITHUB_TOKEN = null;");

  // Remove "***" masking - replace with just GITHUB_TOKEN (null)
  c = c.replace(/'\*\*\*' \+ GITHUB_TOKEN/g, "GITHUB_TOKEN");

  // Replace GitHub API base URL with proxy
  c = c.replace(/https:\/\/api\.github\.com\/repos\/dingfeng901228-oss\/frank-blog\//g, '/api/github?path=dingfeng901228-oss/frank-blog/');

  fs.writeFileSync(file, c);
  console.log('fixed: ' + file);
});