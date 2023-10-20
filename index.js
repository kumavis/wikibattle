const fs = require('fs');

const [,,action, ...args] = process.argv;

main();

async function main () {
  switch (action) {
    case 'download':
      const count = args[0];
      const articles = await getMostViewedArticles(count);
      fs.writeFileSync('data/articles.json', JSON.stringify(articles, null, 2));
      console.log(`Downloaded ${articles.length} articles`);
      break;
    case 'battle':
      const articleData = require('./data/articles.json');
      battleArticles(articleData);
      break;
    default:
      console.log(`Unknown action "${action}"`);
  }
}

function battleArticles (articles) {
  class MapArray {
    constructor () {
      this.map = new Map();
    }
    get (key) {
      let result = this.map.get(key);
      if (!result) {
        result = [];
        this.map.set(key, result);
      }
      return result;
    }
    // set (key, value) {
    //   this.map.set(key, value);
    // }
    add (key, value) {
      this.get(key).push(value);
    }
    entries () {
      return this.map.entries();
    }
  }
  const articlesToBattle = articles.slice();
  const defeatedBy = new MapArray();
  const victories = new MapArray();

  function getPastOpponentsPower (article) {
    let power = 0;
    for (const opponent of victories.get(article.title)) {
      power += opponent.count;
    }
    return power;
  }

  function getArticlePower (article) {
    return article.count + getPastOpponentsPower(article);
  }

  // Helper function to calculate the probability of winning a battle
  function calculateWinProbability (article1, article2) {
    const power1 = getArticlePower(article1);
    const power2 = getArticlePower(article2);
    const totalPower = power1 + power2;
    const probability1 = power1 / totalPower;
    return probability1;
  }

  // Helper function to determine the winner of a battle
  function determineWinner (article1, article2) {
    const winProbability = calculateWinProbability(article1, article2);
    const randomValue = Math.random();
    const winner = randomValue < winProbability ? article1 : article2;
    const loser = winner === article1 ? article2 : article1;
    victories.add(winner, loser);
    defeatedBy.add(loser, winner);
    return { winner, loser };
  }

  // Helper function to find the article with the most victories
  function findWinner () {
    let maxVictories = 0;
    let winner = null;
    for (const [article, opponents] of victories.entries()) {
      const hasMoreVictories = opponents.length > maxVictories;
      const hasDefeats = defeatedBy.get(article).length > 0;
      if (hasMoreVictories && !hasDefeats) {
        maxVictories = opponents.length;
        winner = article;
      }
    }
    return winner;
  }

  function removeArticle (article) {
    const index = articlesToBattle.indexOf(article);
    if (index >= 0) {
      articlesToBattle.splice(index, 1);
    }
  }

  // Main loop to battle all articles
  while (articlesToBattle.length > 1) {
    const article1Index = Math.floor(Math.random() * articlesToBattle.length);
    let article2Index = Math.floor(Math.random() * (articlesToBattle.length - 1));
    if (article2Index >= article1Index) {
      article2Index++;
    }
    const article1 = articlesToBattle[article1Index];
    const article2 = articlesToBattle[article2Index];
    const { winner, loser } = determineWinner(article1, article2);
    console.log(`"${winner.title}" vs "${loser.title}" => "${winner.title}" wins!`);
    removeArticle(loser);
    // removeArticle(article2);
  }

  // Handle the final article
  const winner = findWinner();
  console.log(`Final winner: (${getArticlePower(winner)}) ${winner.title}`);
  console.log(`Victories:`);
  for (const opponent of victories.get(winner)) {
    console.log(`- (${getArticlePower(opponent)}) ${opponent.title}`);
  }
}

async function getMostViewedArticles(count = 100) {
  const articles = [];
  const paginationMax = 500;
  for (let offset = 0; offset < count; offset += paginationMax) {
    const pageCount = Math.min(paginationMax, count - offset);
    articles.push(...await fetchMostViewedArticles(offset, pageCount));
  }
  return articles;
}

async function fetchMostViewedArticles(offset = 0, limit = 500) {
  // Set the endpoint URL for the Wikipedia API
  const endpointUrl = 'https://en.wikipedia.org/w/api.php';
  // Set the parameters for the API request
  const params = {
    action: 'query',
    format: 'json',
    list: 'mostviewed',
    pvimoffset: offset,
    pvimlimit: limit,
  };
  // Use the fetch API to make the API request
  const response = await fetch(endpointUrl + '?' + new URLSearchParams(params));
  const data = await response.json();
  const articles = data.query.mostviewed
    .filter(article => article.ns === 0)
    .filter(article => article.title !== 'Main Page')
  for (const article of articles) {
    article.links = await fetchArticleLinks(article.title);
  }
  return articles;
}

async function fetchArticleLinks(article, offset = 0, limit = 500) {
  // Set the endpoint URL for the Wikipedia API
  const endpointUrl = 'https://en.wikipedia.org/w/api.php';
  // Set the parameters for the API request
  const params = {
    action: 'query',
    format: 'json',
    prop: 'links',
    titles: article,
    plnamespace: 0,
    // plcontinue: offset,
    pllimit: limit,
  };
  // Use the fetch API to make the API request
  const response = await fetch(endpointUrl + '?' + new URLSearchParams(params));
  const data = await response.json();
  // console.log(data.query.pages);
  const [pageData] = Object.values(data.query.pages)
  const links = pageData.links.map(link => link.title);
  return links;
}