import { useState, useEffect } from 'react';
import nlp from 'compromise';

export function useMessageLogic(text) {
  const [sentences, setSentences] = useState([]);

  useEffect(() => {
    const doc = nlp(text);
    setSentences(doc.sentences().out('array'));
  }, [text]);

  return {
    sentences,
  };
}
