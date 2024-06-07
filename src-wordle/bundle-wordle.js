function get_dictionary_location(){return path_join(path_dirname(document.location.href), "src-wordle/dictionary.json");}class Dictionary{constructor(){this._dictionary = new Set();}load_dictionary(done){let local_dictionary = localStorage.getItem("dictionary");if(!local_dictionary){let req = $.ajax({method: "GET",url: get_dictionary_location()});req.done((msg) => {local_dictionary = JSON.parse(msg);console.log(local_dictionary);if(!("version" in local_dictionary ) ||   !("words" in local_dictionary)){done(false, "Cannot load dictionary");return;}console.log(`Downloaded dictionary version ${local_dictionary.version}`);local_dictionary = local_dictionary.words;if(local_dictionary.length){localStorage.setItem("dictionary", JSON.stringify(local_dictionary));for(const word of local_dictionary){this._dictionary.add(word.toLowerCase());}done(true, "");return;}else{done(false, "Cannot load dictionary");return;}});req.fail((_, text_status) => {done(false, "There was a problem downloading the dictionary");return;});}else{local_dictionary = JSON.parse(local_dictionary);if(local_dictionary.length){for(const word of local_dictionary){this._dictionary.add(word.toLowerCase());}done(true, "");}else{localStorage.removeItem("dictionary");this.load_dictionary();}}}is_word_valid(word){if(typeof word != "string" && !(word instanceof String)){word = word.join('');}return this._dictionary.has(word.toLowerCase());}}var dictionary = new Dictionary();function encrypt_word(word){let r = [];word = word.toLowerCase();word = window.btoa(word);r = encodeURIComponent(word).split('');return r;}function decrypt_word(word){let r = [];word = decodeURIComponent(word);word = window.atob(word);r = word.split('');return r;}function get_ans_box_id(row, col){return "ans-r" + row.toString() + "-c" + col.toString();}class Game{constructor(cor_word, on_finish, try_max = 6){this.restart(cor_word, on_finish, try_max);}restart(cor_word, on_finish, try_max){this._on_finish = on_finish;this._try_n = 0;this._try_max = try_max;this._cor_word = cor_word;this._overall_letter_status = create_letter_status();this._try_freeze = new SyncLock();this._word_attempts = ["","","","","",""];this._word_attempts_status = [];this._game_over = false;this._restore_progress();}answer(word, animate = true){if(word.length == this._cor_word.length){let word_str = word.join('');if(dictionary.is_word_valid(word_str)){this._word_attempts[this._try_n] = word_str;localStorage.setItem("progress", this._generate_progress_JSON());const row = this._try_n + 1;const [ letter_status, letter_frequency ] = this._generate_letter_status(word);this._word_attempts_status.push(letter_status);let done = () => {};if(letter_frequency.empty()){done = () =>{this._on_finish(true, this._word_attempts_status);this._game_over = true;};}else{this._try_n += 1;if(this._try_n == this._try_max){done = () =>{this._on_finish(false, this._word_attempts_status);this._game_over = true;};}}this._update_answer_boxes(row, letter_status, animate, done);this._update_letter_boxes(letter_status);return true;}else{show_quick_message("Not in word list", EQM_LOGO.EQML_ERROR);}}else{show_quick_message("Not enough letters", EQM_LOGO.EQML_ERROR);}return false;}attempt_number(){return this._try_n;}attempt_max(){return this._try_max;}game_over(){return this._game_over;}_update_answer_box(element, status){switch(status){case ELETTER_STATUS.ELS_INCORRECT:element.addClass("ans-box-letter-incorrect");break;case ELETTER_STATUS.ELS_PARTIAL:element.addClass("ans-box-letter-partial");break;case ELETTER_STATUS.ELS_CORRECT:element.addClass("ans-box-letter-correct");break;}}_update_answer_boxes(row, letter_status, animate, done){for(const i in letter_status){const c = parseInt(i) + 1;const id = get_ans_box_id(row, c);let el = $(`#${id}`);el.html(letter_status[i].letter.toUpperCase());if(animate){this._try_freeze.lock();let delay = (c - 1) * 100;el.addClass("ans-box-anim-spin-in");el.attr("style", `animation-delay: ${delay}ms;`);el.on("animationend", (event) =>{if(event.originalEvent.animationName == "anim-box-spin-in"){el.attr("style", `animation-delay: 0ms;`);el.removeClass("ans-box-anim-spin-in");el.addClass("ans-box-anim-spin-out");this._update_answer_box(el, letter_status[i].status);}else if(event.originalEvent.animationName == "anim-box-spin-out"){el.removeClass("ans-box-anim-spin-out");this._try_freeze.unlock();if(!this._try_freeze.count()){done();}el.off("animationend");}});}else{this._update_answer_box(el, letter_status[i].status);if(i == letter_status.length - 1){done();}}}}_update_letter_boxes(letter_status){for(const ls of letter_status){if(is_new_status_stronger(this._overall_letter_status[ls.letter], ls.status)){let el = $(`#key-${ls.letter}`);let sstr = status_to_string(this._overall_letter_status[ls.letter]);el.removeClass(`key-box-${sstr}`);this._overall_letter_status[ls.letter] = ls.status;sstr = status_to_string(ls.status);el.addClass(`key-box-${sstr}`);}}}_generate_letter_status(word){let letter_status = [];let letter_frequency = new LetterFrequency(cor_ans);for(const i in word){const c1 = word[i];const c2 = cor_ans[i];if(c1 == c2){letter_frequency.subtract_letter_count(c1);letter_status.push({ letter: c1, status: ELETTER_STATUS.ELS_CORRECT });}else{if(letter_frequency.contains(c1)){letter_frequency.subtract_letter_count(c1);letter_status.push({ letter: c1, status: ELETTER_STATUS.ELS_PARTIAL });}else{letter_status.push({ letter: c1, status: ELETTER_STATUS.ELS_INCORRECT });}}}return [ letter_status, letter_frequency ];}_generate_progress_JSON(){let ret = new Object();ret["word"] = this._cor_word.join('');for(let i = 0; i < this._try_max; ++i){ret[`attempt${i + 1}`] = this._word_attempts[i];}return JSON.stringify(ret);}_restore_progress(){this._clear_word_attempts();let progress = localStorage.getItem("progress");let cor_word_str = this._cor_word.join('');if(!progress){localStorage.setItem("progress", this._generate_progress_JSON());}else{progress = JSON.parse(progress);if(progress.word == cor_word_str){for(let i = 0; i < 6; ++i){let attempt = progress[`attempt${i+1}`];if(attempt.length && attempt.length == this._cor_word.length){this.answer(attempt.split(''), false);}}}else{localStorage.setItem("progress", this._generate_progress_JSON());}}}_clear_word_attempts(){this._word_attempts = ["","","","","",""];this._word_attempts_status = [];}}class LetterFrequency{constructor(word){this._word = new Map();for(const c of word){if(this._word.has(c)){this._word.set(c, this._word.get(c) + 1);}else{this._word.set(c, 1);}}}empty(){return this._word.size == 0;}contains(c){return this._word.has(c);}subtract_letter_count(c){this._word.set(c, this._word.get(c) - 1);if(this._word.get(c) == 0){this._word.delete(c);}}}const ELETTER_STATUS = Object.freeze({ELS_EMPTY: 0,ELS_INCORRECT: 1,ELS_PARTIAL: 2,ELS_CORRECT: 3});function status_to_string(status){if(status == ELETTER_STATUS.ELS_EMPTY){return "unused";}else if(status == ELETTER_STATUS.ELS_INCORRECT){return "incorrect";}else if(status == ELETTER_STATUS.ELS_PARTIAL){return "partial";}else if(status == ELETTER_STATUS.ELS_CORRECT){return "correct";}return "";}function is_new_status_stronger(old_letter_status, new_letter_status){return new_letter_status > old_letter_status;}function create_letter_status(){return {"a": ELETTER_STATUS.ELS_EMPTY,"b": ELETTER_STATUS.ELS_EMPTY,"c": ELETTER_STATUS.ELS_EMPTY,"d": ELETTER_STATUS.ELS_EMPTY,"e": ELETTER_STATUS.ELS_EMPTY,"f": ELETTER_STATUS.ELS_EMPTY,"g": ELETTER_STATUS.ELS_EMPTY,"h": ELETTER_STATUS.ELS_EMPTY,"i": ELETTER_STATUS.ELS_EMPTY,"j": ELETTER_STATUS.ELS_EMPTY,"k": ELETTER_STATUS.ELS_EMPTY,"l": ELETTER_STATUS.ELS_EMPTY,"m": ELETTER_STATUS.ELS_EMPTY,"n": ELETTER_STATUS.ELS_EMPTY,"o": ELETTER_STATUS.ELS_EMPTY,"p": ELETTER_STATUS.ELS_EMPTY,"q": ELETTER_STATUS.ELS_EMPTY,"r": ELETTER_STATUS.ELS_EMPTY,"s": ELETTER_STATUS.ELS_EMPTY,"t": ELETTER_STATUS.ELS_EMPTY,"u": ELETTER_STATUS.ELS_EMPTY,"v": ELETTER_STATUS.ELS_EMPTY,"w": ELETTER_STATUS.ELS_EMPTY,"x": ELETTER_STATUS.ELS_EMPTY,"y": ELETTER_STATUS.ELS_EMPTY,"z": ELETTER_STATUS.ELS_EMPTY};}function path_join(path1, path2){path1 = path1.split('/');path2 = path2.split('/');return path1.concat(path2).join('/');}function path_basename(path){return path.split('/').pop();}function path_dirname(path){path = path.split('/');path.pop();return path.join('/');}function path_extname(path){return path_basename(path).split('.').pop();}const EQM_LOGO = Object.freeze({EQML_ERROR: 0,EQML_WARNING: 1,EQML_INFO: 2});function show_quick_message(msg, type){let el1 = $("#quick-msg");let el2 = $("#quick-msg-modal");el1.show();el2.html(`${msg}`);el2.show();el2.addClass("quick-msg-anim-hide");el2.on("animationend", () =>{el2.removeClass("quick-msg-anim-hide");el1.hide();el2.hide();});}function request_field_to_object(request_field) {let ret = {};let t1 = request_field.split("&");for(const i in t1){let t2 = t1[i].split("=");if(t2.length == 2){ret[t2[0]] = t2[1];}}return ret;}class SyncLock{constructor(){this._n_lock = 0;}lock(){this._n_lock += 1;}unlock(){this._n_lock -= 1;}count(){return this._n_lock;}}var game = null;var try_ans = [];function do_add_letter(letter){if(game._try_freeze.count() > 0 ||   game.game_over()){return;}letter = letter.toLowerCase();if(try_ans.length < cor_ans.length){try_ans.push(letter);const r = game.attempt_number() + 1;const c = try_ans.length;const id = get_ans_box_id(r, c);let el = $(`#${id}`);el.removeClass("ans-box-empty");el.addClass("ans-box-filled");el.addClass("ans-box-filled-anim");el.html(letter.toUpperCase());el.on("animationend", () =>{el.removeClass("ans-box-filled-anim");});}}function do_press_backspace(){if(game._try_freeze.count() > 0 ||   game.game_over()){return;}if(try_ans.length){try_ans.splice(try_ans.length - 1, 1);const r = game.attempt_number() + 1;const c = try_ans.length + 1;const id = get_ans_box_id(r, c);let el = $("#" + id);el.removeClass("ans-box-filled");el.addClass("ans-box-empty");el.html("");}}function do_press_enter(){if(game._try_freeze.count() > 0 ||   game.game_over()){return;}if(game.answer(try_ans)){try_ans = [];}}function handle_key_down(event){if(game.attempt_number() < game.attempt_max()){let key = event.key;if(key == "Enter"){do_press_enter();}else if(key == "Backspace"){do_press_backspace();}else if(key.length == 1 && key.match("[a-zA-Z]")){do_add_letter(key);}}}function get_encrypted_word_from_url(){let f = window.location.href;f = f.split('?');if(f.length != 2){return "";}rq = request_field_to_object(f[1]);if(!("wordcode" in rq)){return "";}return rq.wordcode;}function get_word_from_url(){let ew = get_encrypted_word_from_url();if(ew.length){return decrypt_word(ew);}return ew.split('');}