const BUNDLED_CHARACTERS = Object.freeze([
  {
    id: 'Chara1',
    name: 'Chara1',
    description: 'PC版TaskMateと同じ既定キャラクターです。',
    builtIn: true,
    images: {
      wait: require('../../assets/characters/Chara1/wait.png'),
      click: require('../../assets/characters/Chara1/click.png'),
      alarm: require('../../assets/characters/Chara1/alarm.png')
    },
    dialogues: require('../../assets/characters/Chara1/dialogues.json')
  },
  {
    id: 'Chara2',
    name: 'Chara2',
    description: 'PC版TaskMateに同梱されているもう一人のキャラクターです。',
    builtIn: true,
    images: {
      wait: require('../../assets/characters/Chara2/wait.png'),
      click: require('../../assets/characters/Chara2/click.png'),
      alarm: require('../../assets/characters/Chara2/alarm.png')
    },
    dialogues: require('../../assets/characters/Chara2/dialogues.json')
  }
]);

module.exports = {
  BUNDLED_CHARACTERS
};
